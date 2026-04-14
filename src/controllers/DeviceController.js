const DeviceService = require('../services/DeviceService');
const logger = require('../utils/logger');
const { formatResponse, paginate } = require('../utils/helpers');

class DeviceController {
  async getAllDevices(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const result = await DeviceService.getAllDevices(pagination);

      res.status(200).json(
        formatResponse(result.data, 'Devices retrieved successfully', {
          total: result.total,
          page: pagination.page,
          limit: pagination.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getDeviceById(req, res, next) {
    try {
      const device = await DeviceService.getDeviceById(req.params.id);

      res.status(200).json(
        formatResponse(device, 'Device retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async updateCameraStatus(req, res, next) {
    try {
      const { cameraBlocked } = req.body;

      const device = await DeviceService.updateCameraStatus(req.params.id, cameraBlocked);

      res.status(200).json(
        formatResponse(device, 'Camera status updated successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteDevice(req, res, next) {
    try {
      await DeviceService.deleteDevice(req.params.id);

      res.status(200).json(
        formatResponse(null, 'Device deleted successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async getDevicePolicies(req, res, next) {
    try {
      const policies = await DeviceService.getDevicePolicies(req.params.id);

      res.status(200).json(
        formatResponse(policies, 'Device policies retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DeviceController();
