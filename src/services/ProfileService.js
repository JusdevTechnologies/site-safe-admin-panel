const db = require('../models');
const logger = require('../utils/logger');
const NanoMDMService = require('../integrations/NanoMDMService');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const ExternalServiceError = require('../exceptions/ExternalServiceError');
const FirebaseService = require('../integrations/FirebaseService');

class ProfileService {
  async _getEnrollmentId(udid) {
    const device = await db.Device.findOne({
      where: { device_identifier: udid },
      paranoid: false,
    });
    if (!device) {
      throw new NotFoundError(`Device ${udid} not found in local database`);
    }
    const enrollmentId = device.device_info && device.device_info.nanomdm_enrollment_id;
    if (!enrollmentId) {
      throw new ExternalServiceError(
        `No NanoMDM enrollment ID found for device ${udid}. Device may not have completed MDM enrollment.`,
      );
    }
    return { enrollmentId, device };
  }

  async createProfile(profileData) {
    logger.info(`[ProfileService] Profile registered: ${profileData.PayloadIdentifier}`);
    return this._formatProfile({}, profileData);
  }

  async updateProfile(identifier, profileData) {
    if (!identifier) {
      throw new NotFoundError('Profile identifier is required for update');
    }
    logger.info(`[ProfileService] Profile update acknowledged: ${identifier}`);
    return this._formatProfile({}, { ...profileData, PayloadIdentifier: identifier });
  }

  async deleteProfile(identifier) {
    if (!identifier) {
      throw new NotFoundError('Profile identifier is required for deletion');
    }
    logger.info(`[ProfileService] Profile deletion acknowledged: ${identifier}`);
    return { deleted: true, identifier };
  }

  async getProfiles(params = {}) {
    logger.info('[ProfileService] Querying installed profiles from database');

    const where = { is_active: true };

    if (params.filter && params.filter.udid) {
      const device = await db.Device.findOne({
        where: { device_identifier: params.filter.udid },
        paranoid: false,
      });
      if (device) {
        where.device_id = device.id;
      } else {
        return { profiles: [] };
      }
    }

    const policies = await db.DevicePolicy.findAll({
      where,
      include: [
        {
          model: db.Device,
          attributes: ['id', 'device_identifier', 'device_name', 'serial_number'],
          paranoid: false,
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const profiles = policies.map((p) => ({
      PayloadIdentifier: p.policy_type,
      PayloadDisplayName: p.policy_details?.PayloadDisplayName || p.policy_type,
      PayloadOrganization: p.policy_details?.PayloadOrganization || null,
      PayloadDescription: p.policy_details?.PayloadDescription || null,
      device_identifier: p.Device?.device_identifier || null,
      device_name: p.Device?.device_name || null,
      is_active: p.is_active,
      applied_at: p.applied_at,
    }));

    return { profiles };
  }

  async getProfile(identifier) {
    if (!identifier) {
      throw new NotFoundError('Profile identifier is required');
    }

    logger.info(`[ProfileService] Getting profile: ${identifier}`);

    const policy = await db.DevicePolicy.findOne({
      where: { policy_type: identifier, is_active: true },
      include: [
        {
          model: db.Device,
          attributes: ['id', 'device_identifier', 'device_name', 'serial_number'],
          paranoid: false,
        },
      ],
      order: [['created_at', 'DESC']],
    });

    if (!policy) {
      throw new NotFoundError(`Profile ${identifier} not found in local database`);
    }

    return {
      PayloadIdentifier: policy.policy_type,
      PayloadDisplayName: policy.policy_details?.PayloadDisplayName || policy.policy_type,
      PayloadOrganization: policy.policy_details?.PayloadOrganization || null,
      PayloadDescription: policy.policy_details?.PayloadDescription || null,
      device_identifier: policy.Device?.device_identifier || null,
      device_name: policy.Device?.device_name || null,
      is_active: policy.is_active,
      applied_at: policy.applied_at,
    };
  }

  async assignProfile(udid, profilePayload) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required to assign a profile');
    }
    if (!profilePayload || !profilePayload.PayloadIdentifier) {
      throw new NotFoundError('Profile payload with PayloadIdentifier is required');
    }

    logger.info(
      `[ProfileService] Assigning profile ${profilePayload.PayloadIdentifier} to device ${udid}`,
    );

    const { enrollmentId, device: localDevice } = await this._getEnrollmentId(udid);

    const existingPolicy = await db.DevicePolicy.findOne({
      where: {
        device_id: localDevice.id,
        policy_type: profilePayload.PayloadIdentifier,
        is_active: true,
      },
    });

    if (existingPolicy) {
      throw new ConflictError(
        `Profile ${profilePayload.PayloadIdentifier} is already assigned to device ${udid}`,
      );
    }

    const commandPayload = {
      command: 'InstallProfile',
      device_udids: [udid],
      profile: profilePayload,
    };

    const result = await NanoMDMService.enqueueCommand(enrollmentId, commandPayload);

    try {
      await NanoMDMService.sendPush(enrollmentId);
    } catch (pushError) {
      logger.warn(
        `[ProfileService] APNs push failed for ${enrollmentId} (non-fatal): ${pushError.message}`,
      );
    }

    await db.DevicePolicy.create({
      device_id: localDevice.id,
      policy_type: profilePayload.PayloadIdentifier,
      policy_details: profilePayload,
      is_active: true,
      applied_at: new Date(),
    });

    logger.info(
      `[ProfileService] DevicePolicy record created for device ${localDevice.id}, profile ${profilePayload.PayloadIdentifier}`,
    );

    this._sendProfileInstalledNotification(localDevice, profilePayload.PayloadIdentifier);

    return result;
  }

  async removeProfile(udid, profileIdentifier) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required to remove a profile');
    }
    if (!profileIdentifier) {
      throw new NotFoundError('Profile identifier is required');
    }

    logger.info(`[ProfileService] Removing profile ${profileIdentifier} from device ${udid}`);

    const { enrollmentId, device: localDevice } = await this._getEnrollmentId(udid);

    const commandPayload = {
      command: 'RemoveProfile',
      device_udids: [udid],
      profile_identifier: profileIdentifier,
    };

    const result = await NanoMDMService.enqueueCommand(enrollmentId, commandPayload);

    try {
      await NanoMDMService.sendPush(enrollmentId);
    } catch (pushError) {
      logger.warn(
        `[ProfileService] APNs push failed for ${enrollmentId} (non-fatal): ${pushError.message}`,
      );
    }

    const policy = await db.DevicePolicy.findOne({
      where: {
        device_id: localDevice.id,
        policy_type: profileIdentifier,
        is_active: true,
      },
    });

    if (policy) {
      await policy.update({ is_active: false });
      logger.info(
        `[ProfileService] DevicePolicy ${policy.id} marked inactive for device ${localDevice.id}`,
      );
    }

    this._sendProfileRemovedNotification(localDevice, profileIdentifier);

    return result;
  }

  _sendProfileInstalledNotification(device, profileName) {
    this._trySendNotification(
      FirebaseService.sendProfileInstalledNotification(device, profileName),
      `profile-installed for device ${device.id}, profile ${profileName}`,
    );
  }

  _sendProfileRemovedNotification(device, profileName) {
    this._trySendNotification(
      FirebaseService.sendProfileRemovedNotification(device, profileName),
      `profile-removed for device ${device.id}, profile ${profileName}`,
    );
  }

  async _trySendNotification(promise, label) {
    try {
      await promise;
    } catch (notifError) {
      logger.warn(
        `[ProfileService] FCM notification failed (non-fatal): ${label}: ${notifError.message}`,
      );
    }
  }

  _formatProfile(result, profileData) {
    return {
      identifier: profileData.PayloadIdentifier,
      organization: profileData.PayloadOrganization || null,
      description: profileData.PayloadDescription || null,
      displayName: profileData.PayloadDisplayName || null,
      ...(result || {}),
    };
  }
}

module.exports = new ProfileService();
