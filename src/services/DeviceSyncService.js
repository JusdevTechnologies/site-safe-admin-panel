const db = require('../models');
const logger = require('../utils/logger');

const UPDATE_ALLOWED_FIELDS = [
  'device_name',
  'serial_number',
  'device_os',
  'supervised',
  'push_notification_token',
  'notification_platform',
  'last_sync',
];

class DeviceSyncService {
  async updateDeviceFromCheckIn(checkInData) {
    const {
      udid,
      serialNumber,
      deviceName,
      model,
      productType,
      osVersion,
      buildVersion,
      pushToken,
      pushMagic,
      enrollmentId,
    } = checkInData;

    if (!udid && !serialNumber) {
      logger.warn('[DeviceSync] Check-in data missing udid and serialNumber — skipping');
      return null;
    }

    const identifier = udid || serialNumber;

    let device = await db.Device.findOne({
      where: { device_identifier: identifier },
      paranoid: false,
    });

    if (!device && serialNumber) {
      device = await db.Device.findOne({
        where: { serial_number: serialNumber },
        paranoid: false,
      });
    }

    if (!device) {
      logger.info(`[DeviceSync] Creating new device record from check-in: ${identifier}`);
      device = await db.Device.create({
        device_identifier: udid || serialNumber,
        serial_number: serialNumber || null,
        device_name: deviceName || null,
        device_os: 'ios',
        status: 'active',
        last_sync: new Date(),
        device_info: {
          nanomdm_enrollment_id: enrollmentId || null,
          push_magic: pushMagic || null,
          model: model || null,
          product_type: productType || null,
          os_version: osVersion || null,
          build_version: buildVersion || null,
        },
      });

      logger.info(`[DeviceSync] Device created from check-in: ${device.id} (${identifier})`);
      return device;
    }

    const updates = {
      last_sync: new Date(),
    };

    if (deviceName !== undefined && deviceName !== null) updates.device_name = String(deviceName);
    if (serialNumber !== undefined && serialNumber !== null)
      updates.serial_number = String(serialNumber);
    if (pushToken !== undefined && pushToken !== null)
      updates.push_notification_token = String(pushToken);

    const deviceInfo = { ...(device.device_info || {}) };
    if (enrollmentId) deviceInfo.nanomdm_enrollment_id = enrollmentId;
    if (pushMagic) deviceInfo.push_magic = pushMagic;
    if (model) deviceInfo.model = model;
    if (productType) deviceInfo.product_type = productType;
    if (osVersion) deviceInfo.os_version = osVersion;
    if (buildVersion) deviceInfo.build_version = buildVersion;
    updates.device_info = deviceInfo;

    if (updates.device_name || updates.serial_number || updates.push_notification_token) {
      await device.update(updates);
      logger.info(`[DeviceSync] Device updated from check-in: ${device.id} (${identifier})`);
    } else {
      await device.update({ last_sync: new Date(), device_info: deviceInfo });
      logger.info(`[DeviceSync] Device check-in timestamp updated: ${device.id} (${identifier})`);
    }

    return device;
  }

  async _updateDevice(localDevice, syncData) {
    const updates = {};

    for (const field of UPDATE_ALLOWED_FIELDS) {
      if (syncData[field] !== undefined) {
        updates[field] = syncData[field];
      }
    }

    if (syncData.device_info !== undefined) {
      const merged = { ...(localDevice.device_info || {}), ...syncData.device_info };
      updates.device_info = merged;
    }

    if (Object.keys(updates).length === 0) {
      return localDevice;
    }

    await localDevice.update(updates);
    return localDevice;
  }
}

module.exports = new DeviceSyncService();
