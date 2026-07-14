const db = require('../models');
const logger = require('../utils/logger');
const environment = require('../../config/environment');
const NotFoundError = require('../exceptions/NotFoundError');
const { v4: uuidv4 } = require('uuid');
const ADEProfileGenerator = require('./ADEProfileGenerator');
const { ADE_ENTITY_TYPES } = require('../constants');

class ADEEnrollmentProfileService {
  async createProfile(data) {
    logger.info('[ADEProfile] Creating enrollment profile');

    if (data.isDefault) {
      await db.EnrollmentProfile.update({ is_default: false }, { where: { is_default: true } });
    }

    const profileUuid = uuidv4();

    const profile = await db.EnrollmentProfile.create({
      profile_uuid: profileUuid,
      display_name: data.displayName,
      description: data.description || null,
      organization: data.organization || environment.ade.organization,
      organization_display_name:
        data.organizationDisplayName || environment.ade.organizationDisplayName || null,
      department: data.department || environment.ade.department || null,
      url: data.url || environment.ade.profileUrl,
      checkin_url: data.checkinUrl || environment.ade.checkinUrl || null,
      topic: data.topic || environment.ade.topic || null,
      version: data.version || environment.ade.profileVersion,
      is_default: data.isDefault || false,
      is_active: data.isActive !== undefined ? data.isActive : true,
      is_mandatory: data.isMandatory !== undefined ? data.isMandatory : environment.ade.isMandatory,
      supervised: data.supervised !== undefined ? data.supervised : environment.ade.supervised,
      allow_profile_removal:
        data.allowProfileRemoval !== undefined
          ? data.allowProfileRemoval
          : environment.ade.allowProfileRemoval,
      await_device_configured:
        data.awaitDeviceConfigured !== undefined
          ? data.awaitDeviceConfigured
          : environment.ade.awaitDeviceConfigured,
      language: data.language || environment.ade.language || null,
      region: data.region || environment.ade.region || null,
      support_contact: data.supportContact || environment.ade.supportContact || null,
      support_email: data.supportEmail || environment.ade.supportEmail || null,
      support_phone: data.supportPhone || environment.ade.supportPhone || null,
      identity_certificate_uuid:
        data.identityCertificateUuid || environment.ade.identityCertificateUuid || null,
      anchor_certificates: data.anchorCertificates || null,
      skip_setup_assistant_items: data.skipSetupAssistantItems || this._parseSkipItems(),
      configuration: data.configuration || null,
      metadata: data.metadata || null,
    });

    await this._recordAudit(
      'ade_profile_created',
      profileUuid,
      { displayName: data.displayName },
      'success',
    );

    logger.info(`[ADEProfile] Created profile ${profileUuid}: ${data.displayName}`);
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
    if (data.organizationDisplayName !== undefined)
      updates.organization_display_name = data.organizationDisplayName;
    if (data.department !== undefined) updates.department = data.department;
    if (data.url !== undefined) updates.url = data.url;
    if (data.checkinUrl !== undefined) updates.checkin_url = data.checkinUrl;
    if (data.topic !== undefined) updates.topic = data.topic;
    if (data.version !== undefined) updates.version = data.version;
    if (data.isDefault !== undefined) updates.is_default = data.isDefault;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.isMandatory !== undefined) updates.is_mandatory = data.isMandatory;
    if (data.supervised !== undefined) updates.supervised = data.supervised;
    if (data.allowProfileRemoval !== undefined)
      updates.allow_profile_removal = data.allowProfileRemoval;
    if (data.awaitDeviceConfigured !== undefined)
      updates.await_device_configured = data.awaitDeviceConfigured;
    if (data.language !== undefined) updates.language = data.language;
    if (data.region !== undefined) updates.region = data.region;
    if (data.supportContact !== undefined) updates.support_contact = data.supportContact;
    if (data.supportEmail !== undefined) updates.support_email = data.supportEmail;
    if (data.supportPhone !== undefined) updates.support_phone = data.supportPhone;
    if (data.identityCertificateUuid !== undefined)
      updates.identity_certificate_uuid = data.identityCertificateUuid;
    if (data.anchorCertificates !== undefined)
      updates.anchor_certificates = data.anchorCertificates;
    if (data.skipSetupAssistantItems !== undefined)
      updates.skip_setup_assistant_items = data.skipSetupAssistantItems;
    if (data.configuration !== undefined) updates.configuration = data.configuration;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    if (Object.keys(updates).length > 0) {
      await profile.update(updates);
      await this._recordAudit('ade_profile_updated', profileUuid, updates, 'success');
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

    const device = await db.Device.findOne({
      where: { serial_number: serialNumber },
      paranoid: false,
    });

    const resolvedProfile = await this._resolveProfileByRules(serialNumber, device, enrollment);

    if (enrollment && !enrollment.profile_uuid) {
      await enrollment.update({ profile_uuid: resolvedProfile.profile_uuid });
    }

    logger.info(
      `[ADEProfile] Resolved profile ${resolvedProfile.profile_uuid} for device ${serialNumber}`,
    );

    await this._recordAudit(
      'ade_profile_resolved',
      resolvedProfile.profile_uuid,
      {
        serialNumber,
        resolutionStrategy: 'rules',
      },
      'success',
    );

    return this._formatProfile(resolvedProfile);
  }

  async _resolveProfileByRules(serialNumber, device, enrollment) {
    // Strategy 1: Use already assigned profile
    if (enrollment && enrollment.profile_uuid) {
      const assigned = await db.EnrollmentProfile.findOne({
        where: { profile_uuid: enrollment.profile_uuid, is_active: true },
      });
      if (assigned) return assigned;
    }

    // Strategy 2: Match by model
    if (enrollment && enrollment.model) {
      const modelProfile = await db.EnrollmentProfile.findOne({
        where: { is_active: true },
      });

      if (modelProfile) {
        const modelConfig = modelProfile.configuration;
        if (
          modelConfig &&
          modelConfig.applicableModels &&
          Array.isArray(modelConfig.applicableModels) &&
          modelConfig.applicableModels.includes(enrollment.model)
        ) {
          return modelProfile;
        }
      }
    }

    // Strategy 3: Match by organization
    if (enrollment && enrollment.organization) {
      const orgProfile = await db.EnrollmentProfile.findOne({
        where: { organization: enrollment.organization, is_active: true },
      });
      if (orgProfile) return orgProfile;
    }

    // Strategy 4: Use default active profile
    const defaultProfile = await db.EnrollmentProfile.findOne({
      where: { is_default: true, is_active: true },
    });

    if (defaultProfile) return defaultProfile;

    // Strategy 5: Create default profile
    logger.warn(`[ADEProfile] No matching profile for ${serialNumber}, creating default`);
    return this._ensureDefaultProfileExists();
  }

  async generateProfileForDevice(serialNumber) {
    logger.info('[ADEProfile] === GENERATE PROFILE FOR DEVICE ===');
    logger.info(`[ADEProfile] Serial number: ${serialNumber}`);

    const profile = await this.getProfileForDevice(serialNumber);

    logger.info(`[ADEProfile] Resolved profile: ${profile.profileUuid}`);
    logger.info(`[ADEProfile] Profile display name: ${profile.displayName}`);
    logger.info(`[ADEProfile] Organization: ${profile.organization}`);
    logger.info(`[ADEProfile] Server URL: ${profile.url}`);
    logger.info(`[ADEProfile] Check-in URL: ${profile.checkinUrl}`);
    logger.info(`[ADEProfile] Topic: ${profile.topic}`);
    logger.info(`[ADEProfile] Version: ${profile.version}`);
    logger.info(`[ADEProfile] Supervised: ${profile.supervised}`);
    logger.info(`[ADEProfile] Mandatory: ${profile.isMandatory}`);
    logger.info(`[ADEProfile] Allow removal: ${profile.allowProfileRemoval}`);
    logger.info(`[ADEProfile] Await device configured: ${profile.awaitDeviceConfigured}`);
    logger.info(`[ADEProfile] Identity cert UUID: ${profile.identityCertificateUuid}`);
    logger.info(
      `[ADEProfile] Skip setup items: ${JSON.stringify(profile.skipSetupAssistantItems)}`,
    );
    logger.info(
      `[ADEProfile] Anchor certs: ${profile.anchorCertificates ? profile.anchorCertificates.length + ' configured' : 'none'}`,
    );

    const enrollment = await db.AdeEnrollment.findOne({
      where: { serial_number: serialNumber },
    });

    if (enrollment) {
      logger.info(
        `[ADEProfile] Enrollment found: ID=${enrollment.id}, status=${enrollment.status}, profile_uuid=${enrollment.profile_uuid}`,
      );
      await enrollment.update({
        profile_uuid: profile.profileUuid,
        profile_generated_at: new Date(),
      });
      logger.info(`[ADEProfile] Enrollment updated with profile_uuid=${profile.profileUuid}`);
    } else {
      logger.warn(`[ADEProfile] No enrollment record found for serial: ${serialNumber}`);
    }

    const genStart = Date.now();
    const mobileconfig = await ADEProfileGenerator.generateMobileconfig(profile, enrollment);
    const genTime = Date.now() - genStart;

    await this._recordAudit(
      'ade_profile_generated',
      profile.profileUuid,
      {
        serialNumber,
        profileVersion: profile.version,
      },
      'success',
    );

    logger.info('[ADEProfile] .mobileconfig generated successfully');
    logger.info(`[ADEProfile] Generator took ${genTime}ms`);
    logger.info(`[ADEProfile] Profile UUID: ${profile.profileUuid}`);
    logger.info(`[ADEProfile] MIME type: ${ADEProfileGenerator.getMimeType()}`);
    logger.info('[ADEProfile] === END GENERATE PROFILE FOR DEVICE ===');

    return {
      profile,
      mobileconfig,
      mimeType: ADEProfileGenerator.getMimeType(),
    };
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

    await this._recordAudit('ade_profile_assigned', profileUuid, { serialNumber }, 'success');
    logger.info(`[ADEProfile] Assigned profile ${profileUuid} to device ${serialNumber}`);

    return this._formatProfile(profile);
  }

  async _ensureDefaultProfileExists() {
    const existing = await db.EnrollmentProfile.findOne({
      where: { is_default: true, is_active: true },
    });

    if (existing) return existing;

    const skipItems = this._parseSkipItems();

    const profile = await db.EnrollmentProfile.create({
      profile_uuid: uuidv4(),
      display_name: 'Default Enrollment Profile',
      description: 'Automatically generated default enrollment profile',
      organization: environment.ade.organization,
      organization_display_name: environment.ade.organizationDisplayName || null,
      url: environment.ade.profileUrl,
      checkin_url: environment.ade.checkinUrl || null,
      topic: environment.ade.topic || null,
      version: environment.ade.profileVersion,
      is_default: true,
      is_active: true,
      is_mandatory: environment.ade.isMandatory,
      supervised: environment.ade.supervised,
      allow_profile_removal: environment.ade.allowProfileRemoval,
      await_device_configured: environment.ade.awaitDeviceConfigured,
      language: environment.ade.language || null,
      region: environment.ade.region || null,
      support_contact: environment.ade.supportContact || null,
      support_email: environment.ade.supportEmail || null,
      support_phone: environment.ade.supportPhone || null,
      skip_setup_assistant_items: skipItems,
    });

    logger.info(`[ADEProfile] Created default profile ${profile.profile_uuid}`);
    return profile;
  }

  _parseSkipItems() {
    const raw = environment.ade.skipSetupItems;
    if (!raw) return null;
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async _recordAudit(action, entityId, metadata, status) {
    try {
      await db.AuditLog.create({
        user_id: null,
        action,
        entity_type: ADE_ENTITY_TYPES.PROFILE,
        entity_id: entityId,
        changes: metadata,
        ip_address: null,
        user_agent: null,
        status,
      });
    } catch (error) {
      logger.error(`[ADEProfile] Audit log error: ${error.message}`);
    }
  }

  _formatProfile(profile) {
    return {
      id: profile.id,
      profileUuid: profile.profile_uuid,
      displayName: profile.display_name,
      description: profile.description,
      organization: profile.organization,
      organizationDisplayName: profile.organization_display_name,
      department: profile.department,
      url: profile.url,
      checkinUrl: profile.checkin_url,
      topic: profile.topic,
      version: profile.version,
      isDefault: profile.is_default,
      isActive: profile.is_active,
      isMandatory: profile.is_mandatory,
      supervised: profile.supervised,
      allowProfileRemoval: profile.allow_profile_removal,
      awaitDeviceConfigured: profile.await_device_configured,
      language: profile.language,
      region: profile.region,
      supportContact: profile.support_contact,
      supportEmail: profile.support_email,
      supportPhone: profile.support_phone,
      identityCertificateUuid: profile.identity_certificate_uuid,
      anchorCertificates: profile.anchor_certificates,
      skipSetupAssistantItems: profile.skip_setup_assistant_items,
      configuration: profile.configuration,
      metadata: profile.metadata,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }
}

module.exports = new ADEEnrollmentProfileService();
