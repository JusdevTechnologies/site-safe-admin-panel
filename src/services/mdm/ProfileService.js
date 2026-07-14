const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const NanoMDMService = require('./NanoMDMService');
const XMLSerializer = require('../profile/XMLSerializer');
const NotFoundError = require('../../exceptions/NotFoundError');

class ProfileService {
  _buildCommandPlist(requestType, profilePayloadXml) {
    const commandUuid = uuidv4();

    const commandDict = {
      Command: {
        RequestType: requestType,
        Payload: Buffer.from(profilePayloadXml, 'utf8'),
      },
      CommandUUID: commandUuid,
    };

    return {
      plist: XMLSerializer.serialize(commandDict),
      command_uuid: commandUuid,
    };
  }

  _buildRemoveCommandPlist(profileIdentifier) {
    const commandUuid = uuidv4();

    const commandDict = {
      Command: {
        RequestType: 'RemoveProfile',
        Identifier: profileIdentifier,
      },
      CommandUUID: commandUuid,
    };

    return {
      plist: XMLSerializer.serialize(commandDict),
      command_uuid: commandUuid,
    };
  }

  async installProfile(udid, profilePayload) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required to install a profile');
    }
    if (!profilePayload || !profilePayload.PayloadIdentifier) {
      throw new NotFoundError('Profile payload with PayloadIdentifier is required');
    }

    logger.info(`[MDM:Profile] Installing profile ${profilePayload.PayloadIdentifier} on device ${udid}`);

    const profilePlist = XMLSerializer.serialize(profilePayload);
    const { plist, command_uuid } = this._buildCommandPlist('InstallProfile', profilePlist);

    const result = await NanoMDMService.enqueueCommand(udid, { command_payload: plist });

    await NanoMDMService.sendPush(udid).catch((err) => {
      logger.warn(`[MDM:Profile] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(`[MDM:Profile] Profile ${profilePayload.PayloadIdentifier} queued for device ${udid}`);

    return {
      command_uuid: command_uuid || result.command_uuid || null,
      udid,
      profile_identifier: profilePayload.PayloadIdentifier,
      status: 'queued',
    };
  }

  async removeProfile(udid, profileIdentifier) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required to remove a profile');
    }
    if (!profileIdentifier) {
      throw new NotFoundError('Profile identifier is required');
    }

    logger.info(`[MDM:Profile] Removing profile ${profileIdentifier} from device ${udid}`);

    const { plist, command_uuid } = this._buildRemoveCommandPlist(profileIdentifier);

    const result = await NanoMDMService.enqueueCommand(udid, { command_payload: plist });

    await NanoMDMService.sendPush(udid).catch((err) => {
      logger.warn(`[MDM:Profile] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(`[MDM:Profile] Profile ${profileIdentifier} removal queued for device ${udid}`);

    return {
      command_uuid: command_uuid || result.command_uuid || null,
      udid,
      profile_identifier: profileIdentifier,
      status: 'queued',
    };
  }
}

module.exports = new ProfileService();
