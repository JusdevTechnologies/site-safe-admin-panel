const { Op } = require('sequelize');
const db = require('../../models');
const logger = require('../../utils/logger');
const NanoMDMService = require('./NanoMDMService');
const ExternalServiceError = require('../../exceptions/ExternalServiceError');

class DeviceSyncService {
  _extractDeviceInfo(baseDevice, detailsDevice) {
    const enrollmentType =
      baseDevice.type === 'Device' ? 'device' : baseDevice.type === 'User' ? 'user' : null;

    const productName = detailsDevice?.product_name || null;
    const osVersion = detailsDevice?.os_version || null;
    const deviceName = detailsDevice?.device_name || null;
    const buildVersion = detailsDevice?.build_version || null;

    return {
      udid: baseDevice.udid || baseDevice.device_udid || baseDevice.enrollment_id,
      serial_number: baseDevice.serial_number || null,
      model: productName,
      os_version: osVersion,
      enrollment_status: 'enrolled',
      enrollment_type: enrollmentType,
      push_token_status: this._resolvePushStatus(baseDevice),
      last_seen: baseDevice.last_seen || baseDevice.last_check_in || null,
      device_info: {
        build_version: buildVersion,
        product_type: null,
        push_magic: baseDevice.push_magic || null,
        device_name: deviceName,
        raw: baseDevice,
      },
    };
  }

  _resolvePushStatus(nanoMDMDevice) {
    if (nanoMDMDevice.push_token_status === 'valid') return 'valid';
    if (nanoMDMDevice.push_token_status === 'invalid') return 'invalid';
    if (nanoMDMDevice.push_token) return 'valid';
    if (nanoMDMDevice.pushToken) return 'valid';
    return 'unknown';
  }

  async syncAllDevices() {
    logger.info('[MDM:DeviceSync] Starting full device sync from NanoMDM');

    let nanoMDMDevices;
    try {
      nanoMDMDevices = await NanoMDMService.listDevices();
    } catch (error) {
      logger.error(`[MDM:DeviceSync] Failed to list devices from NanoMDM: ${error.message}`);
      throw new ExternalServiceError('Failed to sync devices from NanoMDM', {
        cause: error.message,
      });
    }

    if (!Array.isArray(nanoMDMDevices) || nanoMDMDevices.length === 0) {
      logger.info('[MDM:DeviceSync] No devices returned from NanoMDM');
      return { synced: 0, total: 0, errors: [] };
    }

    logger.info(`[MDM:DeviceSync] Received ${nanoMDMDevices.length} devices from NanoMDM`);

    let synced = 0;
    const errors = [];

    for (const nanoDevice of nanoMDMDevices) {
      try {
        const udid = nanoDevice.udid || nanoDevice.device_udid || nanoDevice.enrollment_id;

        let detailsDevice = null;
        try {
          detailsDevice = await NanoMDMService.getDeviceDetails(udid);
        } catch (detailErr) {
          logger.warn(
            `[MDM:DeviceSync] Device detail fetch failed for ${udid} (non-fatal): ${detailErr.message}`,
          );
        }

        const deviceInfo = this._extractDeviceInfo(nanoDevice, detailsDevice);
        await this._upsertDevice(deviceInfo);
        synced += 1;
      } catch (error) {
        const udid = nanoDevice.udid || nanoDevice.device_udid || 'unknown';
        logger.error(`[MDM:DeviceSync] Failed to sync device ${udid}: ${error.message}`);
        errors.push({ udid, error: error.message });
      }
    }

    const now = new Date();
    await db.MDMDevice.update({ last_sync_at: now }, { where: { last_sync_at: { [Op.ne]: now } } });

    logger.info(
      `[MDM:DeviceSync] Sync complete | synced=${synced} | total=${nanoMDMDevices.length} | errors=${errors.length}`,
    );

    return {
      synced,
      total: nanoMDMDevices.length,
      errors,
    };
  }

  async syncDevice(udid) {
    if (!udid) {
      throw new ExternalServiceError('Device UDID is required for sync');
    }

    logger.info(`[MDM:DeviceSync] Syncing single device ${udid} from NanoMDM`);

    let nanoDevice;
    try {
      nanoDevice = await NanoMDMService.getDevice(udid);
    } catch (error) {
      logger.error(`[MDM:DeviceSync] Failed to get device ${udid} from NanoMDM: ${error.message}`);
      const device = await db.MDMDevice.findOne({ where: { udid } });
      if (device) {
        await device.update({
          enrollment_status: 'not_found',
          last_sync_at: new Date(),
        });
      }
      throw new ExternalServiceError(`Failed to sync device ${udid} from NanoMDM`, {
        cause: error.message,
      });
    }

    let detailsDevice = null;
    try {
      detailsDevice = await NanoMDMService.getDeviceDetails(udid);
    } catch (detailErr) {
      logger.warn(
        `[MDM:DeviceSync] Device detail fetch failed for ${udid} (non-fatal): ${detailErr.message}`,
      );
    }

    const deviceInfo = this._extractDeviceInfo(nanoDevice, detailsDevice);
    const device = await this._upsertDevice(deviceInfo);

    logger.info(`[MDM:DeviceSync] Single device sync complete | udid=${udid} | id=${device.id}`);
    return device;
  }

  async _upsertDevice(deviceInfo) {
    const { udid, serial_number } = deviceInfo;

    let device = await db.MDMDevice.findOne({ where: { udid } });

    if (device) {
      const updates = {
        serial_number: serial_number || device.serial_number,
        model: deviceInfo.model || device.model,
        os_version: deviceInfo.os_version || device.os_version,
        enrollment_status: deviceInfo.enrollment_status,
        enrollment_type: deviceInfo.enrollment_type || device.enrollment_type,
        push_token_status: deviceInfo.push_token_status,
        last_seen: deviceInfo.last_seen || device.last_seen,
        last_sync_at: new Date(),
        device_info: deviceInfo.device_info || device.device_info,
      };

      await device.update(updates);
      logger.info(`[MDM:DeviceSync] Updated device ${udid} | id=${device.id}`);
    } else {
      device = await db.MDMDevice.create({
        udid,
        serial_number,
        model: deviceInfo.model,
        os_version: deviceInfo.os_version,
        enrollment_status: deviceInfo.enrollment_status,
        enrollment_type: deviceInfo.enrollment_type,
        push_token_status: deviceInfo.push_token_status,
        camera_state: 'unknown',
        last_seen: deviceInfo.last_seen,
        last_sync_at: new Date(),
        device_info: deviceInfo.device_info || {},
      });
      logger.info(`[MDM:DeviceSync] Created device ${udid} | id=${device.id}`);
    }

    return device;
  }
}

module.exports = new DeviceSyncService();
