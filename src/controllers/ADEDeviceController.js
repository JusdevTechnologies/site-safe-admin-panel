const ADEDeviceService = require('../services/ADEDeviceService');
const { formatResponse } = require('../utils/helpers');

class ADEDeviceController {
  async lookupDevice(req, res, next) {
    try {
      const { serialNumber, model, udid } = req.body;
      const result = await ADEDeviceService.lookupDevice({ serialNumber, model, udid });
      res.status(200).json(formatResponse(result, 'Device lookup completed'));
    } catch (error) {
      next(error);
    }
  }

  async getDeviceBySerial(req, res, next) {
    try {
      const { serial } = req.params;
      const result = await ADEDeviceService.getDeviceBySerial(serial);

      if (!result) {
        return res.status(200).json(formatResponse(null, 'Device not found'));
      }

      res.status(200).json(formatResponse(result, 'Device retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ADEDeviceController();
