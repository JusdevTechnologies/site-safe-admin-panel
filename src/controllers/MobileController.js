const MobileService = require('../services/MobileService');
const MobileValidator = require('../validators/MobileValidator');
const logger = require('../utils/logger');
const { formatResponse } = require('../utils/helpers');

/**
 * Mobile App Controller
 * Handles HTTP requests for mobile app APIs
 */
class MobileController {
  /**
   * POST /api/v1/mobile/devices/register
   * Register a device for mobile app
   */
  async registerDevice(req, res, next) {
    try {
      // Validate request
      const validatedData = MobileValidator.validateDeviceRegistration(req.body);

      // Call service
      const result = await MobileService.registerDevice(validatedData);

      res.status(201).json(formatResponse(result, 'Device registered successfully'));
    } catch (error) {
      logger.error(`Device registration controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * GET /api/v1/mobile/devices/:deviceIdentifier/status
   * Get current device status and user details
   */
  async getDeviceStatus(req, res, next) {
    try {
      const { deviceIdentifier } = req.params;

      // Validate request
      MobileValidator.validateDeviceStatusRequest(deviceIdentifier);

      // Call service
      const result = await MobileService.getDeviceStatus(deviceIdentifier);

      res.status(200).json(formatResponse(result, 'Device status retrieved successfully'));
    } catch (error) {
      logger.error(`Get device status controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * POST /api/v1/mobile/devices/uninstall/otp-request
   * Request OTP for device uninstallation
   */
  async requestUninstallOTP(req, res, next) {
    try {
      // Validate request
      const validatedData = MobileValidator.validateOTPRequest(req.body);

      // Call service
      const result = await MobileService.requestUninstallOTP(validatedData.device_identifier);

      res.status(200).json(formatResponse(result, 'OTP request processed successfully'));
    } catch (error) {
      logger.error(`OTP request controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * POST /api/v1/mobile/devices/uninstall/otp-validate
   * Validate OTP for device uninstallation
   */
  async validateUninstallOTP(req, res, next) {
    try {
      // Validate request
      const validatedData = MobileValidator.validateOTPVerification(req.body);

      // Call service
      const result = await MobileService.validateUninstallOTP(
        validatedData.device_identifier,
        validatedData.otp_code,
      );

      res.status(200).json(formatResponse(result, 'OTP validated successfully'));
    } catch (error) {
      logger.error(`OTP validation controller error: ${error.message}`);
      next(error);
    }
  }
  /**
   * POST /api/v1/mobile/devices/punch
   * Record a punch-in or punch-out event
   */
  async recordPunch(req, res, next) {
    try {
      const validatedData = MobileValidator.validatePunchRecord(req.body);

      const result = await MobileService.recordPunch(
        validatedData.device_identifier,
        validatedData.punch_type,
        validatedData.location,
        validatedData.external_id,
      );

      res.status(201).json(formatResponse(result, 'Punch recorded successfully'));
    } catch (error) {
      logger.error(`Record punch controller error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new MobileController();
