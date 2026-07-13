const db = require('../models');
const logger = require('../utils/logger');
const NanoMDMService = require('../integrations/NanoMDMService');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const FirebaseService = require('../integrations/FirebaseService');

class ProfileService {
  /**
   * Create a new MDM profile in NanoMDM.
   * @param {Object} profileData - Profile payload (must include PayloadIdentifier, PayloadContent)
   */
  async createProfile(profileData) {
    logger.info('[ProfileService] Creating profile');

    const result = await NanoMDMService.createProfile(profileData);
    const identifier = profileData.PayloadIdentifier;

    logger.info(`[ProfileService] Profile created: ${identifier}`);
    return this._formatProfile(result, profileData);
  }

  /**
   * Update an existing MDM profile in NanoMDM.
   * @param {string} identifier - Profile identifier (e.g. com.example.profile)
   * @param {Object} profileData - Updated profile payload
   */
  async updateProfile(identifier, profileData) {
    if (!identifier) {
      throw new NotFoundError('Profile identifier is required for update');
    }

    logger.info(`[ProfileService] Updating profile: ${identifier}`);

    const result = await NanoMDMService.updateProfile(identifier, profileData);

    logger.info(`[ProfileService] Profile updated: ${identifier}`);
    return this._formatProfile(result, { ...profileData, PayloadIdentifier: identifier });
  }

  /**
   * Delete an MDM profile from NanoMDM.
   * @param {string} identifier - Profile identifier
   */
  async deleteProfile(identifier) {
    if (!identifier) {
      throw new NotFoundError('Profile identifier is required for deletion');
    }

    logger.info(`[ProfileService] Deleting profile: ${identifier}`);

    const result = await NanoMDMService.deleteProfile(identifier);

    logger.info(`[ProfileService] Profile deleted: ${identifier}`);
    return result;
  }

  /**
   * Assign (install) a profile on a device.
   * Creates a DevicePolicy record locally to track the assignment.
   * @param {string} udid - Device UDID
   * @param {Object} profilePayload - Profile payload to install
   */
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

    const localDevice = await db.Device.findOne({
      where: { device_identifier: udid },
      paranoid: false,
    });

    const result = await NanoMDMService.installProfile(udid, profilePayload);

    if (localDevice) {
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
    } else {
      logger.warn(
        `[ProfileService] No local device found for UDID ${udid} — DevicePolicy record not created`,
      );
    }

    return result;
  }

  /**
   * Remove a profile from a device.
   * Updates the local DevicePolicy record to mark it inactive.
   * @param {string} udid - Device UDID
   * @param {string} profileIdentifier - Profile identifier to remove
   */
  async removeProfile(udid, profileIdentifier) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required to remove a profile');
    }
    if (!profileIdentifier) {
      throw new NotFoundError('Profile identifier is required');
    }

    logger.info(`[ProfileService] Removing profile ${profileIdentifier} from device ${udid}`);

    const localDevice = await db.Device.findOne({
      where: { device_identifier: udid },
      paranoid: false,
    });

    const result = await NanoMDMService.removeProfile(udid, profileIdentifier);

    if (localDevice) {
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
    }

    return result;
  }

  /**
   * Query profiles from NanoMDM with optional filters.
   * @param {Object} params - Query parameters (e.g. { limit, page, filter })
   */
  async getProfiles(params = {}) {
    logger.info('[ProfileService] Querying profiles');

    const result = await NanoMDMService.getProfiles(params);

    return result;
  }

  /**
   * Get a single profile by identifier from NanoMDM.
   * @param {string} identifier - Profile identifier
   */
  async getProfile(identifier) {
    if (!identifier) {
      throw new NotFoundError('Profile identifier is required');
    }

    logger.info(`[ProfileService] Getting profile: ${identifier}`);

    const result = await NanoMDMService.getProfile(identifier);

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
