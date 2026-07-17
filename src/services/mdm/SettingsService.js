const { v4: uuidv4 } = require('uuid');
const db = require('../../models');
const logger = require('../../utils/logger');
const NanoMDMService = require('./NanoMDMService');
const XMLSerializer = require('../profile/XMLSerializer');
const NotFoundError = require('../../exceptions/NotFoundError');
const ConflictError = require('../../exceptions/ConflictError');

class SettingsService {
  async updateMdmRemovable(udid, removable) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required');
    }

    const device = await db.MDMDevice.findOne({ where: { udid } });
    if (!device) {
      throw new NotFoundError(`Device ${udid} not found. Sync devices first.`);
    }

    if (device.enrollment_type !== 'device') {
      throw new ConflictError(
        'Toggle MDM removable is only available for ADE/DEP-enrolled devices (supervised)',
      );
    }

    const nanoDevice = await NanoMDMService.getDevice(udid);
    if (!nanoDevice || !nanoDevice.enrollment_id) {
      throw new NotFoundError(`Enrollment not found for device ${udid}`);
    }

    const commandUuid = uuidv4();

    const commandDict = {
      Command: {
        RequestType: 'Settings',
        Settings: [
          {
            Item: 'MDMOptions',
            MDMOptions: {
              IsMDMRemovable: removable,
            },
          },
        ],
      },
      CommandUUID: commandUuid,
    };

    const plistXml = XMLSerializer.serialize(commandDict);

    await NanoMDMService.enqueueCommand(nanoDevice.enrollment_id, {
      command_payload: plistXml,
    });

    await NanoMDMService.sendPush(nanoDevice.enrollment_id).catch((err) => {
      logger.warn(`[MDM:Settings] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(
      `[MDM:Settings] IsMDMRemovable=${removable} queued for device ${udid} (enrollment=${nanoDevice.enrollment_id})`,
    );

    return {
      command_uuid: commandUuid,
      udid,
      serial_number: device.serial_number,
      is_removable: removable,
      status: 'queued',
    };
  }
}

module.exports = new SettingsService();
