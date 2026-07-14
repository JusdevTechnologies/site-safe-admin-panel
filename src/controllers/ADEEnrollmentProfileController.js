const ADEEnrollmentProfileService = require('../services/ADEEnrollmentProfileService');
const logger = require('../utils/logger');
const { HTTP_STATUS } = require('../constants');
const { formatResponse, paginate } = require('../utils/helpers');

class ADEEnrollmentProfileController {
  async createProfile(req, res, next) {
    try {
      const result = await ADEEnrollmentProfileService.createProfile(req.body);
      res.status(201).json(formatResponse(result, 'Enrollment profile created'));
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { uuid } = req.params;
      const result = await ADEEnrollmentProfileService.updateProfile(uuid, req.body);
      res.status(200).json(formatResponse(result, 'Enrollment profile updated'));
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const { uuid } = req.params;
      const result = await ADEEnrollmentProfileService.getProfile(uuid);
      res.status(200).json(formatResponse(result, 'Enrollment profile retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async getAllProfiles(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const filters = {
        page: pagination.page,
        limit: pagination.limit,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        isDefault: req.query.isDefault !== undefined ? req.query.isDefault === 'true' : undefined,
      };

      const result = await ADEEnrollmentProfileService.getAllProfiles(filters);
      res.status(200).json(
        formatResponse(result.data, 'Enrollment profiles retrieved', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getProfileForDevice(req, res, next) {
    try {
      const { serialNumber } = req.body;
      const result = await ADEEnrollmentProfileService.getProfileForDevice(serialNumber);
      res.status(200).json(formatResponse(result, 'Profile resolved for device'));
    } catch (error) {
      next(error);
    }
  }

  async assignProfileToDevice(req, res, next) {
    try {
      const { serialNumber, profileUuid } = req.body;
      const result = await ADEEnrollmentProfileService.assignProfileToDevice(
        serialNumber,
        profileUuid,
      );
      res.status(200).json(formatResponse(result, 'Profile assigned to device'));
    } catch (error) {
      next(error);
    }
  }

  async generateProfileForDevice(req, res, next) {
    try {
      const { serialNumber } = req.body;
      const result = await ADEEnrollmentProfileService.generateProfileForDevice(serialNumber);
      res.status(200).json(formatResponse(result, 'Profile generated for device'));
    } catch (error) {
      next(error);
    }
  }

  async downloadProfile(req, res, next) {
    try {
      const { serialNumber } = req.body;
      const result = await ADEEnrollmentProfileService.generateProfileForDevice(serialNumber);

      res.set('Content-Type', result.mimeType);
      res.set(
        'Content-Disposition',
        `attachment; filename="enrollment_${serialNumber}.mobileconfig"`,
      );
      res.send(result.mobileconfig);
    } catch (error) {
      next(error);
    }
  }

  async appleProfile(req, res, next) {
    const startTime = Date.now();
    logger.info('[AppleADE] Incoming GET /profile');

    try {
      const serialNumber =
        req.query.serialNumber ||
        req.query.serial ||
        req.query.SERIAL ||
        req.query.SerialNumber ||
        req.query.device_serial ||
        req.headers['x-serial-number'] ||
        req.headers['x-device-serial'] ||
        req.headers['serial-number'];

      if (!serialNumber) {
        const sanitizedHeaders = { ...req.headers };
        const sensitiveHeaders = [
          'authorization',
          'cookie',
          'set-cookie',
          'x-ade-api-key',
          'x-api-key',
        ];
        sensitiveHeaders.forEach((h) => delete sanitizedHeaders[h]);

        logger.warn('[AppleADE] No serial number found in request', {
          query: req.query,
          headers: sanitizedHeaders,
          method: req.method,
          path: req.path,
          originalUrl: req.originalUrl,
        });

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Serial number missing',
        });
      }

      logger.info(`[AppleADE] Detected serial number: ${serialNumber}`);

      const result = await ADEEnrollmentProfileService.generateProfileForDevice(serialNumber);

      const elapsed = Date.now() - startTime;
      logger.info(`[AppleADE] Profile generated successfully in ${elapsed}ms`);

      res.set('Content-Type', result.mimeType);
      res.set('Content-Disposition', 'attachment; filename="enrollment.mobileconfig"');
      res.send(result.mobileconfig);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error(`[AppleADE] Profile generation failed after ${elapsed}ms: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new ADEEnrollmentProfileController();
