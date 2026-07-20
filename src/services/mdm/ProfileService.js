const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const NanoMDMService = require('./NanoMDMService');
const XMLSerializer = require('../profile/XMLSerializer');
const NotFoundError = require('../../exceptions/NotFoundError');

const MAX_ENQUEUE_RETRIES = 3;

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

  async _enqueueWithRetry(udid, buildFn) {
    let attempt = 0;
    let lastError;

    while (attempt < MAX_ENQUEUE_RETRIES) {
      attempt++;
      const { plist, command_uuid } = buildFn();

      try {
        const result = await NanoMDMService.enqueueCommand(udid, { command_payload: plist });
        return { result, command_uuid };
      } catch (error) {
        lastError = error;
        const msg = error.message || '';
        const isDuplicate = msg.includes('duplicate key') && msg.includes('commands_pkey');

        if (!isDuplicate) throw error;

        logger.warn(
          `[MDM:Profile] Command UUID collision (${command_uuid}) on attempt ${attempt}/${MAX_ENQUEUE_RETRIES} — retrying with new UUID`,
        );
      }
    }

    logger.error(
      `[MDM:Profile] Failed to enqueue after ${MAX_ENQUEUE_RETRIES} attempts: ${lastError.message}`,
    );
    throw lastError;
  }

  async installProfile(udid, profilePayload) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required to install a profile');
    }
    if (!profilePayload || !profilePayload.PayloadIdentifier) {
      throw new NotFoundError('Profile payload with PayloadIdentifier is required');
    }

    logger.info(
      `[MDM:Profile] Installing profile ${profilePayload.PayloadIdentifier} on device ${udid}`,
    );

    const profilePlist = XMLSerializer.serialize(profilePayload);

    const { result, command_uuid } = await this._enqueueWithRetry(udid, () =>
      this._buildCommandPlist('InstallProfile', profilePlist),
    );

    await NanoMDMService.sendPush(udid).catch((err) => {
      logger.warn(`[MDM:Profile] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(
      `[MDM:Profile] Profile ${profilePayload.PayloadIdentifier} queued for device ${udid}`,
    );

    return {
      command_uuid: command_uuid || (result && result.command_uuid) || null,
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

    const { result, command_uuid } = await this._enqueueWithRetry(udid, () =>
      this._buildRemoveCommandPlist(profileIdentifier),
    );

    await NanoMDMService.sendPush(udid).catch((err) => {
      logger.warn(`[MDM:Profile] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(`[MDM:Profile] Profile ${profileIdentifier} removal queued for device ${udid}`);

    return {
      command_uuid: command_uuid || (result && result.command_uuid) || null,
      udid,
      profile_identifier: profileIdentifier,
      status: 'queued',
    };
  }
}

module.exports = new ProfileService();
