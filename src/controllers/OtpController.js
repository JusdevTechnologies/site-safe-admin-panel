const OtpService = require('../services/OtpService');
const logger = require('../utils/logger');
const { formatResponse, paginate } = require('../utils/helpers');

/**
 * OTP Controller
 * Handles OTP generation and management requests for admin panel
 */
class OtpController {
  /**
   * Generate new OTP
   * POST /api/v1/admin/otp/generate
   */
  async generateOtp(req, res, next) {
    try {
      const { deviceId } = req.body;

      const otp = await OtpService.generateOtp(deviceId);

      res.status(201).json(
        formatResponse(otp, 'OTP generated successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current valid OTP for device
   * GET /api/v1/admin/otp/device/:deviceId
   */
  async getCurrentOtp(req, res, next) {
    try {
      const { deviceId } = req.params;

      const otp = await OtpService.getCurrentOtp(deviceId);

      if (!otp) {
        return res.status(200).json(
          formatResponse(null, 'No active OTP found for device'),
        );
      }

      res.status(200).json(
        formatResponse(otp, 'Current OTP retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get OTP history for a device
   * GET /api/v1/admin/otp/device/:deviceId/history
   */
  async getOtpHistory(req, res, next) {
    try {
      const { deviceId } = req.params;
      const pagination = paginate(req.query.page, req.query.limit || 20);

      const result = await OtpService.getOtpHistory(
        deviceId,
        pagination.page,
        pagination.limit,
      );

      res.status(200).json(
        formatResponse(result.data, 'OTP history retrieved successfully', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all OTPs list for admin
   * GET /api/v1/admin/otp
   */
  async getAdminOtpList(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit || 25);
      const filters = {
        status: req.query.status, // 'used', 'pending', 'expired'
        deviceId: req.query.deviceId,
        startDate: req.query.startDate ? new Date(req.query.startDate) : null,
        endDate: req.query.endDate ? new Date(req.query.endDate) : null,
      };

      const result = await OtpService.getAdminOtpList(pagination, filters);

      res.status(200).json(
        formatResponse(result.data, 'OTP list retrieved successfully', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP code
   * POST /api/v1/otp/verify
   */
  async verifyOtp(req, res, next) {
    try {
      const { deviceId, otpCode } = req.body;

      const result = await OtpService.verifyOtp(deviceId, otpCode);

      res.status(200).json(
        formatResponse(result, result.message),
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OtpController();
