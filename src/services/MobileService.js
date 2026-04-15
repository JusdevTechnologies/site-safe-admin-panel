const db = require('../models');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const UnauthorizedError = require('../exceptions/UnauthorizedError');
const logger = require('../utils/logger');
const { generateRandomOTP, calculateOTPExpiry } = require('../utils/helpers');
const FirebaseService = require('../integrations/FirebaseService');

/**
 * Mobile App Service
 * Handles business logic for mobile app APIs
 */
class MobileService {
  /**
   * Register a device for mobile app
   * Creates or updates device registration with push notification token
   *
   * @param {Object} deviceData - Device information
   * @param {string} deviceData.employee_id - Employer-managed employee ID (for example, EMP001)
   * @param {string} deviceData.device_identifier - Unique device identifier
   * @param {string} deviceData.device_os - Device OS ('android' or 'ios')
   * @param {string} deviceData.device_name - Device name (optional)
   * @param {string} deviceData.push_notification_token - Push notification token
   * @param {string} deviceData.notification_platform - Notification platform ('fcm' or 'apns')
   * @returns {Object} - Registered device data
   * @throws {NotFoundError} - If employee not found
   * @throws {ConflictError} - If device registration conflicts
   */
  async registerDevice(deviceData) {
    const {
      employee_id,
      device_identifier,
      device_os,
      device_name,
      push_notification_token,
      notification_platform,
    } = deviceData;

    try {
      // Resolve employer-managed employee ID to the internal employee record.
      const employee = await db.Employee.findOne({
        where: { employee_id },
      });

      if (!employee) {
        throw new NotFoundError('Employee not found. Please verify your employee ID.');
      }

      // Check if employee is active
      if (employee.status !== 'active') {
        throw new UnauthorizedError('Employee account is not active');
      }

      // Try to find existing device by identifier
      let device = await db.Device.findOne({
        where: { device_identifier },
      });

      if (device && device.employee_id !== employee.id) {
        throw new ConflictError(
          'Device identifier is already registered to another employee. Please contact your administrator.',
        );
      }

      if (device) {
        // Update existing device registration
        device = await device.update({
          push_notification_token,
          notification_platform,
          last_push_notification_update: new Date(),
          status: 'active',
        });

        logger.info(
          `Device registration updated: ${device.id} for employee: ${employee.employee_id}`,
        );
      } else {
        // Create new device
        device = await db.Device.create({
          employee_id: employee.id,
          device_identifier,
          device_os,
          device_name,
          push_notification_token,
          notification_platform,
          last_push_notification_update: new Date(),
          status: 'active',
          camera_blocked: false,
        });

        logger.info(`New device registered: ${device.id} for employee: ${employee.employee_id}`);
      }

      return this.formatDeviceResponse(device, employee);
    } catch (error) {
      logger.error(`Device registration error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current device status and user details
   * Returns camera status, device status, and employee information
   *
   * @param {string} deviceIdentifier - Unique device identifier
   * @returns {Object} - Device status and user details
   * @throws {NotFoundError} - If device not found
   */
  async getDeviceStatus(deviceIdentifier) {
    try {
      const device = await db.Device.findOne({
        where: { device_identifier: deviceIdentifier },
        include: [
          {
            model: db.Employee,
          },
        ],
      });

      if (!device) {
        throw new NotFoundError('Device not found. Please register your device first.');
      }

      logger.info(`Device status retrieved: ${device.id}`);

      return {
        device: {
          id: device.id,
          device_identifier: device.device_identifier,
          device_os: device.device_os,
          device_name: device.device_name,
          status: device.status,
          camera_blocked: device.camera_blocked,
          last_sync: device.last_sync,
        },
        user: {
          first_name: device.Employee.first_name,
          last_name: device.Employee.last_name,
          email: device.Employee.email,
          employee_id: device.Employee.employee_id,
          department: device.Employee.department,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Get device status error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Request OTP for device uninstallation
   * Generates 8-digit OTP valid for 5 minutes
   * Invalidates any previous OTPs for this device
   *
   * @param {string} deviceIdentifier - Unique device identifier
   * @returns {Object} - OTP request confirmation (no OTP sent in response for security)
   * @throws {NotFoundError} - If device not found
   */
  async requestUninstallOTP(deviceIdentifier) {
    try {
      const device = await db.Device.findOne({
        where: { device_identifier: deviceIdentifier },
        include: [db.Employee],
      });

      if (!device) {
        throw new NotFoundError('Device not found. Please register your device first.');
      }

      // Check if employee is still active
      const employee = await db.Employee.findByPk(device.employee_id);
      if (!employee || employee.status !== 'active') {
        throw new UnauthorizedError(
          'Employee account is not active. Uninstallation not permitted.',
        );
      }

      // Invalidate any existing unused OTPs
      await db.OneTimePassword.update(
        { is_used: true, used_at: new Date() },
        {
          where: {
            device_id: device.id,
            is_used: false,
            expires_at: {
              [db.Sequelize.Op.gt]: new Date(),
            },
          },
        },
      );

      // Generate 8-digit OTP
      const otpCode = generateRandomOTP(8);
      const expiresAt = calculateOTPExpiry(5); // 5 minutes expiry

      // Create new OTP record
      const otp = await db.OneTimePassword.create({
        device_id: device.id,
        otp_code: otpCode,
        purpose: 'device_uninstall',
        expires_at: expiresAt,
      });

      logger.info(`OTP requested for device: ${device.id}, OTP expires at: ${expiresAt}`);

      // Deliver OTP via Firebase push notification (non-blocking)
      let pushStatus = 'skipped';
      try {
        const pushResult = await FirebaseService.sendOtpPushNotification(device, otpCode);
        pushStatus = pushResult.success ? 'delivered' : 'failed';
      } catch (pushError) {
        logger.error(`OTP push delivery failed (non-fatal): ${pushError.message}`);
        pushStatus = 'failed';
      }

      // Return confirmation — OTP also exposed in development for testing convenience
      return {
        status: 'otp_sent',
        message: 'OTP has been sent to your registered device via push notification',
        expires_in_minutes: 5,
        device_identifier: deviceIdentifier,
        push_status: pushStatus,
        otp_for_testing: process.env.NODE_ENV === 'development' ? otpCode : undefined,
      };
    } catch (error) {
      logger.error(`OTP request error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate OTP for device uninstallation
   * Verifies OTP and marks device for uninstallation
   *
   * @param {string} deviceIdentifier - Unique device identifier
   * @param {string} otpCode - 8-digit OTP code
   * @returns {Object} - OTP validation result
   * @throws {NotFoundError} - If device not found
   * @throws {UnauthorizedError} - If OTP is invalid, expired, or attempts exceeded
   */
  async validateUninstallOTP(deviceIdentifier, otpCode) {
    try {
      const device = await db.Device.findOne({
        where: { device_identifier: deviceIdentifier },
        include: [db.Employee],
      });

      if (!device) {
        throw new NotFoundError('Device not found');
      }

      // Find the latest OTP for this device
      const otp = await db.OneTimePassword.findOne({
        where: {
          device_id: device.id,
          purpose: 'device_uninstall',
        },
        order: [['created_at', 'DESC']],
      });

      if (!otp) {
        throw new UnauthorizedError('No OTP request found for this device');
      }

      // Check if OTP has already been used
      if (otp.is_used) {
        throw new UnauthorizedError('OTP has already been used');
      }

      // Check if OTP has expired
      if (new Date() > otp.expires_at) {
        throw new UnauthorizedError('OTP has expired. Please request a new one.');
      }

      // Check attempt count
      if (otp.attempt_count >= otp.max_attempts) {
        throw new UnauthorizedError(
          'Maximum OTP verification attempts exceeded. Please request a new OTP.',
        );
      }

      // Increment attempt count
      otp.attempt_count += 1;
      await otp.save();

      // Verify OTP code
      if (otp.otp_code !== otpCode) {
        logger.warn(`Invalid OTP attempt for device: ${device.id}, attempt: ${otp.attempt_count}`);

        throw new UnauthorizedError(
          `Invalid OTP. ${otp.max_attempts - otp.attempt_count} attempts remaining.`,
        );
      }

      // OTP is valid - mark as used and device for uninstallation
      otp.is_used = true;
      otp.used_at = new Date();
      await otp.save();

      // Update device status to inactive
      device.status = 'inactive';
      await device.save();

      logger.info(`Device uninstallation verified: ${device.id}`);

      return {
        status: 'otp_verified',
        message: 'OTP verified successfully. Device uninstallation authorized.',
        device_id: device.id,
        device_identifier: deviceIdentifier,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`OTP validation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record a punch-in or punch-out event for the device's employee
   * and send an FCM confirmation notification.
   *
   * @param {string} deviceIdentifier - Unique device identifier
   * @param {'punch_in'|'punch_out'} punchType - Punch direction
   * @param {string|null} location - Optional site / location label
   * @param {string|null} externalId - Optional external system reference
   * @returns {Object} - Punch record summary
   * @throws {NotFoundError} - If device not found
   * @throws {UnauthorizedError} - If employee is inactive
   */
  async recordPunch(deviceIdentifier, punchType, location = null, externalId = null) {
    try {
      const device = await db.Device.findOne({
        where: { device_identifier: deviceIdentifier },
        include: [
          {
            model: db.Employee,
          },
        ],
      });

      if (!device) {
        throw new NotFoundError('Device not found. Please register your device first.');
      }

      if (device.status !== 'active') {
        throw new UnauthorizedError('Device is not active. Please contact your administrator.');
      }

      const employee = device.Employee;
      if (!employee || employee.status !== 'active') {
        throw new UnauthorizedError('Employee account is not active.');
      }

      // Create the punch record
      const punchRecord = await db.PunchRecord.create({
        employee_id: employee.id,
        punch_type: punchType,
        timestamp: new Date(),
        location: location || null,
        source_system: 'mobile_app',
        external_id: externalId || null,
      });

      logger.info(
        `Punch recorded: ${punchType} | employee: ${employee.id} | device: ${device.id} | punch_record: ${punchRecord.id}`,
      );

      // Send FCM confirmation notification (non-blocking — punch is recorded regardless)
      try {
        await FirebaseService.sendPunchNotification(device, punchType, location);
      } catch (notifError) {
        logger.error(`FCM punch notification failed (non-fatal): ${notifError.message}`);
      }

      return {
        punch_record_id: punchRecord.id,
        punch_type: punchRecord.punch_type,
        timestamp: punchRecord.timestamp.toISOString(),
        location: punchRecord.location,
        device_identifier: deviceIdentifier,
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name || ''}`.trim(),
        },
      };
    } catch (error) {
      logger.error(`Punch recording error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format device response for mobile app
   * @private
   */
  formatDeviceResponse(device, employee) {
    return {
      device_id: device.id,
      device_identifier: device.device_identifier,
      device_os: device.device_os,
      device_name: device.device_name,
      status: device.status,
      camera_blocked: device.camera_blocked,
      employee_id: employee.employee_id,
      user: {
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new MobileService();
