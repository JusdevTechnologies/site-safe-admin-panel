const db = require('../models');
const logger = require('../utils/logger');
const environment = require('../../config/environment');
const NotFoundError = require('../exceptions/NotFoundError');
const { v4: uuidv4 } = require('uuid');

class ADEEnrollmentProfileService {
  async createProfile(data) {
    logger.info('[ADEProfile] Creating enrollment profile');
    const {
      displayName,
      description,
      organization,
      url,
      version,
      isDefault,
      isActive,
      configuration,
      metadata,
    } = data;

    if (isDefault) {
      await db.EnrollmentProfile.update({ is_default: false }, { where: { is_default: true } });
    }

    const profileUuid = uuidv4();

    const profile = await db.EnrollmentProfile.create({
      profile_uuid: profileUuid,
      display_name: displayName,
      description: description || null,
      organization: organization || environment.ade.organization,
      url: url || environment.ade.profileUrl,
      version: version || environment.ade.profileVersion,
      is_default: isDefault || false,
      is_active: isActive !== undefined ? isActive : true,
      configuration: configuration || null,
      metadata: metadata || null,
    });

    logger.info(`[ADEProfile] Created profile ${profileUuid}: ${displayName}`);
    return this._formatProfile(profile);
  }

  async updateProfile(profileUuid, data) {
    if (!profileUuid) {
      throw new NotFoundError('Profile UUID is required for update');
    }

    logger.info(`[ADEProfile] Updating profile: ${profileUuid}`);

    const profile = await db.EnrollmentProfile.findOne({
      where: { profile_uuid: profileUuid },
    });

    if (!profile) {
      throw new NotFoundError(`Enrollment profile ${profileUuid} not found`);
    }

    if (data.isDefault) {
      await db.EnrollmentProfile.update(
        { is_default: false },
        { where: { is_default: true, profile_uuid: { [db.Sequelize.Op.ne]: profileUuid } } },
      );
    }

    const updates = {};
    if (data.displayName !== undefined) updates.display_name = data.displayName;
    if (data.description !== undefined) updates.description = data.description;
    if (data.organization !== undefined) updates.organization = data.organization;
    if (data.url !== undefined) updates.url = data.url;
    if (data.version !== undefined) updates.version = data.version;
    if (data.isDefault !== undefined) updates.is_default = data.isDefault;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.configuration !== undefined) updates.configuration = data.configuration;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    if (Object.keys(updates).length > 0) {
      await profile.update(updates);
      logger.info(`[ADEProfile] Profile ${profileUuid} updated`);
    }

    return this._formatProfile(profile);
  }

  async getProfile(profileUuid) {
    if (!profileUuid) {
      throw new NotFoundError('Profile UUID is required');
    }

    const profile = await db.EnrollmentProfile.findOne({
      where: { profile_uuid: profileUuid },
    });

    if (!profile) {
      throw new NotFoundError(`Enrollment profile ${profileUuid} not found`);
    }

    return this._formatProfile(profile);
  }

  async getAllProfiles(filters = {}) {
    const { page = 1, limit = 10, isActive, isDefault } = filters;

    const where = {};
    if (isActive !== undefined && isActive !== null) where.is_active = isActive;
    if (isDefault !== undefined && isDefault !== null) where.is_default = isDefault;

    const offset = (page - 1) * limit;

    const { count, rows } = await db.EnrollmentProfile.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows.map((p) => this._formatProfile(p)),
      total: count,
      page,
      limit,
    };
  }

  async getProfileForDevice(serialNumber) {
    logger.info(`[ADEProfile] Resolving profile for device: ${serialNumber}`);

    const enrollment = await db.AdeEnrollment.findOne({
      where: { serial_number: serialNumber },
    });

    if (enrollment && enrollment.profile_uuid) {
      const profile = await db.EnrollmentProfile.findOne({
        where: { profile_uuid: enrollment.profile_uuid, is_active: true },
      });

      if (profile) {
        logger.info(
          `[ADEProfile] Using assigned profile ${profile.profile_uuid} for device ${serialNumber}`,
        );
        return this._formatProfile(profile);
      }
    }

    const defaultProfile = await db.EnrollmentProfile.findOne({
      where: { is_default: true, is_active: true },
    });

    if (defaultProfile) {
      logger.info(
        `[ADEProfile] Using default profile ${defaultProfile.profile_uuid} for device ${serialNumber}`,
      );

      if (enrollment && !enrollment.profile_uuid) {
        await enrollment.update({ profile_uuid: defaultProfile.profile_uuid });
      }

      return this._formatProfile(defaultProfile);
    }

    logger.warn(`[ADEProfile] No profile found for device ${serialNumber}, creating default`);

    const profile = await this._ensureDefaultProfileExists();

    return this._formatProfile(profile);
  }

  async assignProfileToDevice(serialNumber, profileUuid) {
    if (!serialNumber) {
      throw new NotFoundError('Serial number is required');
    }

    const profile = await db.EnrollmentProfile.findOne({
      where: { profile_uuid: profileUuid, is_active: true },
    });

    if (!profile) {
      throw new NotFoundError(`Active enrollment profile ${profileUuid} not found`);
    }

    const enrollment = await db.AdeEnrollment.findOne({
      where: { serial_number: serialNumber },
    });

    if (enrollment) {
      await enrollment.update({ profile_uuid: profileUuid });
    }

    logger.info(`[ADEProfile] Assigned profile ${profileUuid} to device ${serialNumber}`);

    return this._formatProfile(profile);
  }

  async _ensureDefaultProfileExists() {
    const existing = await db.EnrollmentProfile.findOne({
      where: { is_default: true, is_active: true },
    });

    if (existing) return existing;

    const profile = await db.EnrollmentProfile.create({
      profile_uuid: uuidv4(),
      display_name: 'Default Enrollment Profile',
      description: 'Automatically generated default enrollment profile',
      organization: environment.ade.organization,
      url: environment.ade.profileUrl,
      version: environment.ade.profileVersion,
      is_default: true,
      is_active: true,
    });

    logger.info(`[ADEProfile] Created default profile ${profile.profile_uuid}`);
    return profile;
  }

  _formatProfile(profile) {
    return {
      id: profile.id,
      profileUuid: profile.profile_uuid,
      displayName: profile.display_name,
      description: profile.description,
      organization: profile.organization,
      url: profile.url,
      version: profile.version,
      isDefault: profile.is_default,
      isActive: profile.is_active,
      configuration: profile.configuration,
      metadata: profile.metadata,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }
}

module.exports = new ADEEnrollmentProfileService();
