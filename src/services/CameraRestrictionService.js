const db = require('../models');
const logger = require('../utils/logger');
const ProfileService = require('./ProfileService');
const DeviceService = require('./DeviceService');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');

const CAMERA_RESTRICTION_IDENTIFIER = 'com.sitesafe.camera.restriction';

class CameraRestrictionService {
  getDefaultCameraRestrictionPayload() {
    return {
      PayloadIdentifier: CAMERA_RESTRICTION_IDENTIFIER,
      PayloadType: 'Configuration',
      PayloadDisplayName: 'Camera Restriction',
      PayloadOrganization: 'SiteSafe',
      PayloadDescription: 'Restricts camera access on managed devices',
      PayloadContent: [
        {
          PayloadType: 'com.android.restrictions',
          PayloadIdentifier: `${CAMERA_RESTRICTION_IDENTIFIER}.restrictions`,
          PayloadContent: {
            allowCamera: false,
          },
        },
      ],
    };
  }

  async blockCamera(deviceId, userId, reason) {
    const device = await db.Device.findByPk(deviceId);

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    if (device.camera_blocked) {
      throw new ConflictError('Device camera is already blocked');
    }

    logger.info(`[CameraRestriction] Blocking camera for device ${deviceId}`);

    const result = await ProfileService.assignProfile(
      device.device_identifier,
      this.getDefaultCameraRestrictionPayload(),
    );

    const updatedDevice = await DeviceService.blockDeviceCamera(deviceId, userId, reason);

    logger.info(`[CameraRestriction] Camera blocked for device ${deviceId}`);
    return updatedDevice;
  }

  async unblockCamera(deviceId, userId, reason) {
    const device = await db.Device.findByPk(deviceId);

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    if (!device.camera_blocked) {
      throw new ConflictError('Device camera is already unblocked');
    }

    logger.info(`[CameraRestriction] Unblocking camera for device ${deviceId}`);

    await ProfileService.removeProfile(device.device_identifier, CAMERA_RESTRICTION_IDENTIFIER);

    const updatedDevice = await DeviceService.unblockDeviceCamera(deviceId, userId, reason);

    logger.info(`[CameraRestriction] Camera unblocked for device ${deviceId}`);
    return updatedDevice;
  }

  async getCameraStatus(deviceIdentifier) {
    const device = await db.Device.findOne({
      where: { device_identifier: deviceIdentifier },
    });

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    let nanoMDMStatus = null;
    try {
      const policy = await db.DevicePolicy.findOne({
        where: {
          device_id: device.id,
          policy_type: CAMERA_RESTRICTION_IDENTIFIER,
          is_active: true,
        },
      });
      nanoMDMStatus = policy ? 'restricted' : 'unrestricted';
    } catch (error) {
      logger.warn(
        `[CameraRestriction] Unable to check policy status for ${deviceIdentifier}: ${error.message}`,
      );
    }

    return {
      deviceId: device.id,
      deviceIdentifier: device.device_identifier,
      cameraBlocked: device.camera_blocked,
      nanoMDMStatus,
      cameraBlockedAt: device.camera_blocked_at,
      cameraBlockedBy: device.camera_blocked_by,
    };
  }
}

module.exports = new CameraRestrictionService();
