const ADEEnrollmentProfileService = require('../services/ADEEnrollmentProfileService');
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
}

module.exports = new ADEEnrollmentProfileController();
