const db = require('../models');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * OTP Service
 * Handles One-Time Password generation and management for device uninstallation
 */
class OtpService {
  /**
   * Generate a random 8-digit OTP code
   */
  generateOtpCode() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Generate new OTP for device
   */
  async generateOtp(deviceId, expiryMinutes = 5) {
    try {
      // Verify device exists
      const device = await db.Device.findByPk(deviceId);
      if (!device) {
        throw new NotFoundError('Device not found');
      }

      // Check if there's an active OTP that hasn't expired
      const activeOtp = await db.OneTimePassword.findOne({
        where: {
          device_id: deviceId,
          is_used: false,
          expires_at: {
            [Op.gt]: new Date(),
          },
        },
      });

      if (activeOtp) {
        throw new ConflictError('A valid OTP already exists for this device');
      }

      // Generate new OTP
      const otpCode = this.generateOtpCode();
      const expiresAt = new Date(Date.now() + expiryMinutes * 60000);

      const otp = await db.OneTimePassword.create({
        device_id: deviceId,
        otp_code: otpCode,
        purpose: 'device_uninstall',
        expires_at: expiresAt,
      });

      logger.info(`OTP generated for device ${deviceId}`);

      return this.formatOtp(otp);
    } catch (error) {
      logger.error(`Error generating OTP: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current valid OTP for device
   */
  async getCurrentOtp(deviceId) {
    try {
      const device = await db.Device.findByPk(deviceId);
      if (!device) {
        throw new NotFoundError('Device not found');
      }

      const otp = await db.OneTimePassword.findOne({
        where: {
          device_id: deviceId,
          is_used: false,
          expires_at: {
            [Op.gt]: new Date(),
          },
        },
      });

      if (!otp) {
        return null;
      }

      return this.formatOtp(otp);
    } catch (error) {
      logger.error(`Error fetching current OTP: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get OTP history for device with pagination
   */
  async getOtpHistory(deviceId, page = 1, limit = 20) {
    try {
      const device = await db.Device.findByPk(deviceId);
      if (!device) {
        throw new NotFoundError('Device not found');
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await db.OneTimePassword.findAndCountAll({
        where: { device_id: deviceId },
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });

      return {
        data: rows.map((otp) => this.formatOtpForHistory(otp)),
        total: count,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`Error fetching OTP history: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all OTPs for admin with pagination and filters
   */
  async getAdminOtpList(pagination, filters = {}) {
    try {
      const { page = 1, limit = 25, offset = 0 } = pagination;
      const where = {};

      // Apply status filter
      if (filters.status === 'used') {
        where.is_used = true;
      } else if (filters.status === 'pending') {
        where.is_used = false;
        where.expires_at = { [Op.gt]: new Date() };
      } else if (filters.status === 'expired') {
        where.is_used = false;
        where.expires_at = { [Op.lte]: new Date() };
      }

      // Apply device filter
      if (filters.deviceId) {
        where.device_id = filters.deviceId;
      }

      // Apply date range filter
      if (filters.startDate || filters.endDate) {
        where.created_at = {
          [Op.gte]: filters.startDate || new Date(0),
          [Op.lte]: filters.endDate || new Date(),
        };
      }

      const { count, rows } = await db.OneTimePassword.findAndCountAll({
        where,
        include: [
          {
            model: db.Device,
            attributes: ['id', 'device_identifier', 'device_name'],
            include: [
              {
                model: db.Employee,
                attributes: ['id', 'employee_id', 'first_name', 'last_name', 'email'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset,
        subQuery: false,
      });

      return {
        data: rows.map((otp) => this.formatOtpForAdmin(otp)),
        total: count,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`Error fetching admin OTP list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(deviceId, otpCode) {
    try {
      const otp = await db.OneTimePassword.findOne({
        where: {
          device_id: deviceId,
          otp_code: otpCode,
        },
      });

      if (!otp) {
        throw new NotFoundError('Invalid OTP');
      }

      // Check if OTP is already used
      if (otp.is_used) {
        throw new ConflictError('OTP has already been used');
      }

      // Check if OTP has expired
      if (new Date() > otp.expires_at) {
        throw new ConflictError('OTP has expired');
      }

      // Check max attempts
      if (otp.attempt_count >= otp.max_attempts) {
        throw new ConflictError('Maximum OTP verification attempts exceeded');
      }

      // Mark OTP as used
      await otp.update({
        is_used: true,
        used_at: new Date(),
      });

      logger.info(`OTP verified for device ${deviceId}`);

      return {
        success: true,
        message: 'OTP verified successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        // Increment attempt count on verification failure
        try {
          const otp = await db.OneTimePassword.findOne({
            where: {
              device_id: deviceId,
              otp_code: otpCode,
            },
          });

          if (otp && !otp.is_used) {
            await otp.increment('attempt_count');
          }
        } catch (e) {
          logger.warn(`Error incrementing OTP attempt count: ${e.message}`);
        }
      }

      logger.error(`Error verifying OTP: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format OTP for response
   */
  formatOtp(otp) {
    return {
      id: otp.id,
      deviceId: otp.device_id,
      otpCode: otp.otp_code,
      isUsed: otp.is_used,
      usedAt: otp.used_at,
      expiresAt: otp.expires_at,
      expiresIn: Math.max(0, Math.ceil((otp.expires_at - new Date()) / 1000)), // seconds
      createdAt: otp.created_at,
    };
  }

  /**
   * Format OTP for history response
   */
  formatOtpForHistory(otp) {
    const status = otp.is_used ? 'used' : new Date() > otp.expires_at ? 'expired' : 'pending';

    return {
      id: otp.id,
      otpCode: otp.otp_code,
      status,
      createdAt: otp.created_at,
      expiresAt: otp.expires_at,
      usedAt: otp.used_at,
      attemptCount: otp.attempt_count,
      maxAttempts: otp.max_attempts,
    };
  }

  /**
   * Format OTP for admin panel response
   */
  formatOtpForAdmin(otp) {
    const status = otp.is_used ? 'used' : new Date() > otp.expires_at ? 'expired' : 'pending';

    return {
      id: otp.id,
      otpCode: otp.otp_code,
      status,
      device: otp.Device
        ? {
            id: otp.Device.id,
            deviceIdentifier: otp.Device.device_identifier,
            deviceName: otp.Device.device_name,
            employee: otp.Device.Employee
              ? {
                  id: otp.Device.Employee.id,
                  employeeId: otp.Device.Employee.employee_id,
                  name: `${otp.Device.Employee.first_name || ''} ${otp.Device.Employee.last_name || ''}`.trim(),
                  email: otp.Device.Employee.email,
                }
              : null,
          }
        : null,
      createdAt: otp.created_at,
      expiresAt: otp.expires_at,
      usedAt: otp.used_at,
      attemptCount: otp.attempt_count,
      maxAttempts: otp.max_attempts,
    };
  }
}

module.exports = new OtpService();
