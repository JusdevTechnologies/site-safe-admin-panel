const db = require('../../models');
const logger = require('../../utils/logger');
const ProfileService = require('./ProfileService');
const NotFoundError = require('../../exceptions/NotFoundError');
const ConflictError = require('../../exceptions/ConflictError');

const CAMERA_RESTRICTION_IDENTIFIER = 'com.sitesafe.camera.restriction';

class CameraRestrictionService {
  _buildRestrictionPayload(allowCamera) {
    return {
      PayloadIdentifier: CAMERA_RESTRICTION_IDENTIFIER,
      PayloadType: 'Configuration',
      PayloadDisplayName: 'Camera Restriction',
      PayloadOrganization: 'SiteSafe',
      PayloadDescription: 'Restricts camera access on managed iOS devices',
      PayloadContent: [
        {
          PayloadType: 'com.apple.applicationaccess',
          PayloadIdentifier: `${CAMERA_RESTRICTION_IDENTIFIER}.payload`,
          PayloadUUID: require('uuid').v4(),
          PayloadVersion: 1,
          PayloadDisplayName: 'Camera Restriction',
          allowCamera,
        },
      ],
    };
  }

  async disableCamera(udid) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required');
    }

    const device = await db.MDMDevice.findOne({ where: { udid } });
    if (!device) {
      throw new NotFoundError(`Device ${udid} not found. Sync devices first.`);
    }

    if (device.camera_state === 'restricted') {
      throw new ConflictError('Camera is already restricted on this device');
    }

    logger.info(`[MDM:CameraRestriction] Disabling camera on device ${udid}`);

    const profile = this._buildRestrictionPayload(false);

    const result = await ProfileService.installProfile(udid, profile);

    await device.update({ camera_state: 'restricted' });

    logger.info(`[MDM:CameraRestriction] Camera disabled on device ${udid}`);

    return {
      udid: device.udid,
      serial_number: device.serial_number,
      camera_state: 'restricted',
      command_uuid: result.command_uuid || null,
    };
  }

  async enableCamera(udid) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required');
    }

    const device = await db.MDMDevice.findOne({ where: { udid } });
    if (!device) {
      throw new NotFoundError(`Device ${udid} not found. Sync devices first.`);
    }

    if (device.camera_state === 'unrestricted') {
      throw new ConflictError('Camera is already unrestricted on this device');
    }

    logger.info(`[MDM:CameraRestriction] Enabling camera on device ${udid}`);

    const profile = this._buildRestrictionPayload(true);

    const result = await ProfileService.installProfile(udid, profile);

    await device.update({ camera_state: 'unrestricted' });

    logger.info(`[MDM:CameraRestriction] Camera enabled on device ${udid}`);

    return {
      udid: device.udid,
      serial_number: device.serial_number,
      camera_state: 'unrestricted',
      command_uuid: result.command_uuid || null,
    };
  }

  async getCameraStatus(udid) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required');
    }

    const device = await db.MDMDevice.findOne({ where: { udid } });
    if (!device) {
      throw new NotFoundError(`Device ${udid} not found. Sync devices first.`);
    }

    return {
      udid: device.udid,
      serial_number: device.serial_number,
      camera_state: device.camera_state,
      last_sync_at: device.last_sync_at,
    };
  }
}

module.exports = new CameraRestrictionService();
