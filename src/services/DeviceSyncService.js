const db = require('../models');
const logger = require('../utils/logger');
const NanoMDMService = require('../integrations/NanoMDMService');

const SYNC_ALLOWED_FIELDS = [
  'serial_number',
  'device_name',
  'last_sync',
  'push_notification_token',
];

class DeviceSyncService {
  /**
   * Full synchronization: fetch all devices from NanoMDM,
   * match by UDID and update local records.
   */
  async fullSync() {
    logger.info('[DeviceSync] Starting full sync');

    let nanoDevices;
    try {
      const response = await NanoMDMService.getDevices({ limit: 1000 });
      nanoDevices = response.devices || [];
    } catch (error) {
      logger.error(`[DeviceSync] Full sync failed to fetch NanoMDM devices: ${error.message}`);
      throw error;
    }

    if (nanoDevices.length === 0) {
      logger.info('[DeviceSync] Full sync completed — no devices returned from NanoMDM');
      return { synced: 0, skipped: 0, errors: 0 };
    }

    const result = await this._syncDeviceList(nanoDevices);
    logger.info(
      `[DeviceSync] Full sync completed | synced: ${result.synced} | skipped: ${result.skipped} | errors: ${result.errors}`,
    );
    return result;
  }

  /**
   * Incremental synchronization: fetch devices modified since a given timestamp.
   * @param {Date|string} [since] - ISO date string or Date. Defaults to 24 hours ago.
   */
  async incrementalSync(since) {
    const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sinceStr = typeof sinceDate === 'string' ? sinceDate : sinceDate.toISOString();

    logger.info(`[DeviceSync] Starting incremental sync since ${sinceStr}`);

    let nanoDevices;
    try {
      const response = await NanoMDMService.getDevices({
        limit: 1000,
        since: sinceStr,
      });
      nanoDevices = response.devices || [];
    } catch (error) {
      logger.error(
        `[DeviceSync] Incremental sync failed to fetch NanoMDM devices: ${error.message}`,
      );
      throw error;
    }

    if (nanoDevices.length === 0) {
      logger.info('[DeviceSync] Incremental sync completed — no recently modified devices');
      return { synced: 0, skipped: 0, errors: 0 };
    }

    const result = await this._syncDeviceList(nanoDevices);
    logger.info(
      `[DeviceSync] Incremental sync completed | synced: ${result.synced} | skipped: ${result.skipped} | errors: ${result.errors}`,
    );
    return result;
  }

  /**
   * Single device sync: update one device by its UDID.
   * @param {string} udid - Device UDID
   */
  async syncDevice(udid) {
    logger.info(`[DeviceSync] Starting single device sync for UDID: ${udid}`);

    let nanoDevice;
    try {
      nanoDevice = await NanoMDMService.getDevice(udid);
    } catch (error) {
      logger.error(`[DeviceSync] Single device sync failed for ${udid}: ${error.message}`);
      throw error;
    }

    const syncData = this._mapNanoMDMDevice(nanoDevice);

    if (!syncData) {
      logger.warn(`[DeviceSync] No UDID in NanoMDM response for device ${udid} — skipping`);
      return { synced: 0, skipped: 1, errors: 0 };
    }

    const localDevice = await db.Device.findOne({
      where: { device_identifier: syncData.device_identifier },
      paranoid: false,
    });

    if (!localDevice) {
      logger.warn(
        `[DeviceSync] No local device found with identifier ${syncData.device_identifier} — skipping`,
      );
      return { synced: 0, skipped: 1, errors: 0 };
    }

    try {
      await this._updateDevice(localDevice, syncData);
      logger.info(`[DeviceSync] Synced device ${localDevice.id} (${syncData.device_identifier})`);
      return { synced: 1, skipped: 0, errors: 0 };
    } catch (error) {
      logger.error(`[DeviceSync] Error updating device ${localDevice.id}: ${error.message}`);
      return { synced: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Process a list of NanoMDM devices: match each to a local device and update.
   * @param {Array} nanoDevices - Array of NanoMDM device objects
   * @returns {Promise<{synced: number, skipped: number, errors: number}>}
   */
  async _syncDeviceList(nanoDevices) {
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    const udids = nanoDevices
      .map((n) => this._mapNanoMDMDevice(n))
      .filter((d) => d && d.device_identifier)
      .map((d) => d.device_identifier);

    if (udids.length === 0) {
      return { synced: 0, skipped: nanoDevices.length, errors: 0 };
    }

    const localDevices = await db.Device.findAll({
      where: { device_identifier: udids },
      paranoid: false,
    });

    const localByUdid = {};
    for (const device of localDevices) {
      localByUdid[device.device_identifier] = device;
    }

    for (const nanoDevice of nanoDevices) {
      const syncData = this._mapNanoMDMDevice(nanoDevice);
      if (!syncData || !syncData.device_identifier) {
        skipped += 1;
        continue;
      }

      const localDevice = localByUdid[syncData.device_identifier];
      if (!localDevice) {
        skipped += 1;
        continue;
      }

      try {
        await this._updateDevice(localDevice, syncData);
        synced += 1;
      } catch (error) {
        logger.error(
          `[DeviceSync] Error updating device ${localDevice.id} (${syncData.device_identifier}): ${error.message}`,
        );
        errors += 1;
      }
    }

    return { synced, skipped, errors };
  }

  /**
   * Map a NanoMDM device object to the fields we sync locally.
   * Only returns fields that are safe to overwrite.
   *
   * Expected NanoMDM format:
   * {
   *   udid: string,
   *   serial_number?: string,
   *   device_name?: string,
   *   platform?: 'ios' | 'android',
   *   last_seen?: string (ISO date),
   *   supervised?: boolean,
   *   push_token?: string
   * }
   */
  _mapNanoMDMDevice(nanoDevice) {
    if (!nanoDevice || !nanoDevice.udid) return null;

    const mapped = {
      device_identifier: nanoDevice.udid,
    };

    if (nanoDevice.serial_number !== null && nanoDevice.serial_number !== undefined) {
      mapped.serial_number = String(nanoDevice.serial_number);
    }

    if (nanoDevice.device_name !== null && nanoDevice.device_name !== undefined) {
      mapped.device_name = String(nanoDevice.device_name);
    }

    if (nanoDevice.last_seen !== null && nanoDevice.last_seen !== undefined) {
      mapped.last_sync = new Date(nanoDevice.last_seen);
    }

    if (nanoDevice.platform !== null && nanoDevice.platform !== undefined) {
      const platform = nanoDevice.platform.toLowerCase();
      if (platform === 'ios' || platform === 'android') {
        mapped.device_os = platform;
      }
    }

    if (nanoDevice.supervised !== null && nanoDevice.supervised !== undefined) {
      mapped.supervised = Boolean(nanoDevice.supervised);
    }

    if (nanoDevice.push_token !== null && nanoDevice.push_token !== undefined) {
      mapped.push_notification_token = String(nanoDevice.push_token);
    }

    return mapped;
  }

  /**
   * Update a local device record with data from NanoMDM.
   * Only SYNC_ALLOWED_FIELDS and device_os/supervised are overwritten.
   * Locally managed fields (camera status, employee assignments, etc.) are preserved.
   */
  async _updateDevice(localDevice, syncData) {
    const updates = {};

    for (const field of SYNC_ALLOWED_FIELDS) {
      if (syncData[field] !== undefined) {
        updates[field] = syncData[field];
      }
    }

    if (syncData.device_os !== undefined) {
      updates.device_os = syncData.device_os;
    }

    if (syncData.supervised !== undefined) {
      updates.supervised = syncData.supervised;
    }

    if (Object.keys(updates).length === 0) {
      return localDevice;
    }

    await localDevice.update(updates);
    return localDevice;
  }
}

module.exports = new DeviceSyncService();
