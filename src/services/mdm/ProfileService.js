const logger = require('../../utils/logger');
const NanoMDMService = require('./NanoMDMService');
const NotFoundError = require('../../exceptions/NotFoundError');

class ProfileService {
  async installProfile(udid, profilePayload) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required to install a profile');
    }
    if (!profilePayload || !profilePayload.PayloadIdentifier) {
      throw new NotFoundError('Profile payload with PayloadIdentifier is required');
    }

    logger.info(`[MDM:Profile] Installing profile ${profilePayload.PayloadIdentifier} on device ${udid}`);

    const commandPayload = {
      command: 'InstallProfile',
      device_udids: [udid],
      profile: profilePayload,
    };

    const result = await NanoMDMService.enqueueCommand(udid, commandPayload);

    await NanoMDMService.sendPush(udid).catch((err) => {
      logger.warn(`[MDM:Profile] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(`[MDM:Profile] Profile ${profilePayload.PayloadIdentifier} queued for device ${udid}`);

    return {
      command_uuid: result.command_uuid || null,
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

    const commandPayload = {
      command: 'RemoveProfile',
      device_udids: [udid],
      profile_identifier: profileIdentifier,
    };

    const result = await NanoMDMService.enqueueCommand(udid, commandPayload);

    await NanoMDMService.sendPush(udid).catch((err) => {
      logger.warn(`[MDM:Profile] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(`[MDM:Profile] Profile ${profileIdentifier} removal queued for device ${udid}`);

    return {
      command_uuid: result.command_uuid || null,
      udid,
      profile_identifier: profileIdentifier,
      status: 'queued',
    };
  }
}

module.exports = new ProfileService();
