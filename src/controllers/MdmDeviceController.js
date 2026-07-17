const db = require('../models');
const { formatResponse } = require('../utils/helpers');
const {
  DeviceSyncService,
  CameraRestrictionService,
  DeviceCommandService,
  SettingsService,
} = require('../services/mdm');

class MdmDeviceController {
  async listDevices(req, res, next) {
    try {
      const { page = 1, limit = 20, status, search } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const where = {};
      if (status) where.enrollment_status = status;
      if (search) {
        where[db.Sequelize.Op.or] = [
          { udid: { [db.Sequelize.Op.iLike]: `%${search}%` } },
          { serial_number: { [db.Sequelize.Op.iLike]: `%${search}%` } },
          { model: { [db.Sequelize.Op.iLike]: `%${search}%` } },
        ];
      }

      const { count, rows } = await db.MDMDevice.findAndCountAll({
        where,
        order: [['updated_at', 'DESC']],
        limit: limitNum,
        offset,
      });

      const devices = rows.map((d) => ({
        id: d.id,
        udid: d.udid,
        serial_number: d.serial_number,
        model: d.model,
        os_version: d.os_version,
        enrollment_status: d.enrollment_status,
        enrollment_type: d.enrollment_type,
        push_token_status: d.push_token_status,
        camera_state: d.camera_state,
        camera_status:
          d.camera_state === 'restricted'
            ? 'disabled'
            : d.camera_state === 'unrestricted'
              ? 'enabled'
              : 'unknown',
        last_seen: d.last_seen,
        last_sync_at: d.last_sync_at,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));

      res.status(200).json(
        formatResponse({ devices }, 'MDM devices retrieved successfully', {
          total: count,
          page: pageNum,
          limit: limitNum,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getDevice(req, res, next) {
    try {
      const { id } = req.params;

      const device = await db.MDMDevice.findByPk(id);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: { message: 'MDM device not found', code: 'NOT_FOUND', statusCode: 404 },
        });
      }

      res.status(200).json(
        formatResponse(
          {
            id: device.id,
            udid: device.udid,
            serial_number: device.serial_number,
            model: device.model,
            os_version: device.os_version,
            enrollment_status: device.enrollment_status,
            enrollment_type: device.enrollment_type,
            push_token_status: device.push_token_status,
            camera_state: device.camera_state,
            camera_status:
              device.camera_state === 'restricted'
                ? 'disabled'
                : device.camera_state === 'unrestricted'
                  ? 'enabled'
                  : 'unknown',
            last_seen: device.last_seen,
            last_sync_at: device.last_sync_at,
            device_info: device.device_info,
            created_at: device.created_at,
            updated_at: device.updated_at,
          },
          'MDM device retrieved successfully',
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async disableCamera(req, res, next) {
    try {
      const { id } = req.params;

      const device = await db.MDMDevice.findByPk(id);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: { message: 'MDM device not found', code: 'NOT_FOUND', statusCode: 404 },
        });
      }

      const result = await CameraRestrictionService.disableCamera(device.udid);

      res.status(200).json(formatResponse(result, 'Camera disable command queued'));
    } catch (error) {
      next(error);
    }
  }

  async enableCamera(req, res, next) {
    try {
      const { id } = req.params;

      const device = await db.MDMDevice.findByPk(id);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: { message: 'MDM device not found', code: 'NOT_FOUND', statusCode: 404 },
        });
      }

      const result = await CameraRestrictionService.enableCamera(device.udid);

      res.status(200).json(formatResponse(result, 'Camera enable command queued'));
    } catch (error) {
      next(error);
    }
  }

  async getDeviceCommands(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.query;

      const device = await db.MDMDevice.findByPk(id);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: { message: 'MDM device not found', code: 'NOT_FOUND', statusCode: 404 },
        });
      }

      const result = await DeviceCommandService.getDeviceCommands(device.udid, status);

      res.status(200).json(formatResponse(result, 'Device commands retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async updateMdmRemovable(req, res, next) {
    try {
      const { id } = req.params;
      const { removable } = req.body;

      if (typeof removable !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'removable must be a boolean (true/false)',
            code: 'VALIDATION_ERROR',
            statusCode: 400,
          },
        });
      }

      const device = await db.MDMDevice.findByPk(id);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: { message: 'MDM device not found', code: 'NOT_FOUND', statusCode: 404 },
        });
      }

      const result = await SettingsService.updateMdmRemovable(device.udid, removable);

      res
        .status(200)
        .json(
          formatResponse(result, `MDM profile set to ${removable ? 'removable' : 'non-removable'}`),
        );
    } catch (error) {
      next(error);
    }
  }

  async syncDevices(req, res, next) {
    try {
      const result = await DeviceSyncService.syncAllDevices();

      res.status(200).json(formatResponse(result, 'MDM devices synchronized successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MdmDeviceController();
