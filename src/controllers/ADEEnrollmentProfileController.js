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
    logger.info('========================================================');
    logger.info('[AppleADE] === APPLE ADE /profile REQUEST ===');
    logger.info(`[AppleADE] Method: ${req.method} ${req.originalUrl}`);
    logger.info(`[AppleADE] IP: ${req.ip}`);

    const logHeaders = { ...req.headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-ade-api-key',
      'x-api-key',
    ];
    sensitiveHeaders.forEach((h) => delete logHeaders[h]);
    logger.info(`[AppleADE] Query params: ${JSON.stringify(req.query)}`);
    logger.info(`[AppleADE] Headers: ${JSON.stringify(logHeaders, null, 2)}`);

    try {
      let serialSource = 'none';
      const serialNumber =
        ((serialSource = 'query.serialNumber'), req.query.serialNumber) ||
        ((serialSource = 'query.serial'), req.query.serial) ||
        ((serialSource = 'query.SERIAL'), req.query.SERIAL) ||
        ((serialSource = 'query.SerialNumber'), req.query.SerialNumber) ||
        ((serialSource = 'query.device_serial'), req.query.device_serial) ||
        ((serialSource = 'header.x-ADM-device-serial-number'),
        req.headers['x-adm-device-serial-number']) ||
        ((serialSource = 'header.x-serial-number'), req.headers['x-serial-number']) ||
        ((serialSource = 'header.x-device-serial'), req.headers['x-device-serial']) ||
        ((serialSource = 'header.serial-number'), req.headers['serial-number']);

      if (!serialNumber) {
        logger.warn('[AppleADE] === NO SERIAL NUMBER FOUND ===');
        logger.warn('[AppleADE] All query params:', JSON.stringify(req.query));
        logger.warn('[AppleADE] All headers (sanitized):', JSON.stringify(logHeaders));

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Serial number missing',
        });
      }

      logger.info('[AppleADE] === SERIAL NUMBER EXTRACTED ===');
      logger.info(`[AppleADE] Source: ${serialSource}`);
      logger.info(`[AppleADE] Value: ${serialNumber}`);

      const result = await ADEEnrollmentProfileService.generateProfileForDevice(serialNumber);

      const elapsed = Date.now() - startTime;
      const profileSize = result.mobileconfig ? result.mobileconfig.length : 0;
      logger.info('[AppleADE] === PROFILE GENERATED SUCCESSFULLY ===');
      logger.info(`[AppleADE] MIME type: ${result.mimeType}`);
      logger.info(`[AppleADE] Profile size: ${profileSize} bytes`);
      logger.info(`[AppleADE] Generation time: ${elapsed}ms`);
      logger.info(
        `[AppleADE] Profile UUID: ${result.profile ? result.profile.profileUuid : 'N/A'}`,
      );

      res.set('Content-Type', result.mimeType);
      res.set('Content-Disposition', 'attachment; filename="enrollment.mobileconfig"');
      logger.info('[AppleADE] Response headers set');
      logger.info(`[AppleADE] Content-Type: ${result.mimeType}`);
      logger.info('[AppleADE] Content-Disposition: attachment; filename="enrollment.mobileconfig"');
      logger.info(`[AppleADE] Sending ${profileSize} bytes to device`);
      logger.info(`[AppleADE] === END /profile REQUEST (${elapsed}ms) ===`);
      logger.info('========================================================');
      res.send(result.mobileconfig);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error('[AppleADE] === PROFILE GENERATION FAILED ===');
      logger.error(`[AppleADE] Error: ${error.message}`);
      logger.error(`[AppleADE] Stack: ${error.stack}`);
      logger.error(`[AppleADE] Failure time: ${elapsed}ms`);
      logger.error(`[AppleADE] === END /profile REQUEST (${elapsed}ms) ===`);
      logger.info('========================================================');
      next(error);
    }
  }
}

module.exports = new ADEEnrollmentProfileController();
