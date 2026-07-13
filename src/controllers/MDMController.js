const db = require('../models');
const NanoMDMService = require('../integrations/NanoMDMService');
const ProfileService = require('../services/ProfileService');
const MDMCommandService = require('../services/MDMCommandService');
const DeviceService = require('../services/DeviceService');
const { formatResponse, paginate } = require('../utils/helpers');

class MDMController {
  async getDevices(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit || 20);
      const filters = {
        search: req.query.search,
        status: req.query.status,
        os: req.query.os,
      };

      const result = await DeviceService.getAdminDeviceList(pagination, filters);

      res.status(200).json(
        formatResponse(result.data, 'MDM devices retrieved successfully', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getProfiles(req, res, next) {
    try {
      const result = await ProfileService.getProfiles(req.query);

      res.status(200).json(formatResponse(result, 'MDM profiles retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async installProfile(req, res, next) {
    try {
      const { udid, profilePayload } = req.body;

      const result = await ProfileService.assignProfile(udid, profilePayload);

      res.status(200).json(formatResponse(result, 'Profile installed successfully'));
    } catch (error) {
      next(error);
    }
  }

  async removeProfile(req, res, next) {
    try {
      const { udid, profileIdentifier } = req.body;

      const result = await ProfileService.removeProfile(udid, profileIdentifier);

      res.status(200).json(formatResponse(result, 'Profile removed successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getCommands(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const filters = {
        page: pagination.page,
        limit: pagination.limit,
        status: req.query.status,
        commandType: req.query.commandType,
        deviceIdentifier: req.query.deviceIdentifier,
      };

      const result = await MDMCommandService.getCommands(filters);

      res.status(200).json(
        formatResponse(result.data, 'MDM commands retrieved successfully', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MDMController();
