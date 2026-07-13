const Joi = require('joi');
const { ADE_ENROLLMENT_STATUS, SKIP_SETUP_ITEMS } = require('../constants');

const STATUS_VALUES = Object.values(ADE_ENROLLMENT_STATUS);
const SKIP_ITEMS_VALUES = Object.values(SKIP_SETUP_ITEMS);

class ADEValidator {
  static deviceLookupSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required(),
      model: Joi.string().trim().optional().allow('', null),
      udid: Joi.string().trim().optional().allow('', null),
    }).required();
  }

  static createProfileSchema() {
    return Joi.object({
      displayName: Joi.string().trim().max(255).required(),
      description: Joi.string().trim().optional().allow('', null),
      organization: Joi.string().trim().max(255).required(),
      organizationDisplayName: Joi.string().trim().max(255).optional().allow('', null),
      department: Joi.string().trim().max(255).optional().allow('', null),
      url: Joi.string().trim().uri().required(),
      checkinUrl: Joi.string().trim().uri().optional().allow('', null),
      topic: Joi.string().trim().optional().allow('', null),
      version: Joi.number().integer().min(1).optional(),
      isDefault: Joi.boolean().optional(),
      isActive: Joi.boolean().optional(),
      isMandatory: Joi.boolean().optional(),
      supervised: Joi.boolean().optional(),
      allowProfileRemoval: Joi.boolean().optional(),
      awaitDeviceConfigured: Joi.boolean().optional(),
      language: Joi.string().trim().max(10).optional().allow('', null),
      region: Joi.string().trim().max(10).optional().allow('', null),
      supportContact: Joi.string().trim().max(255).optional().allow('', null),
      supportEmail: Joi.string().email().optional().allow('', null),
      supportPhone: Joi.string().trim().max(50).optional().allow('', null),
      identityCertificateUuid: Joi.string().trim().optional().allow('', null),
      anchorCertificates: Joi.array().items(Joi.string()).optional(),
      skipSetupAssistantItems: Joi.array().items(
        Joi.string().valid(...SKIP_ITEMS_VALUES),
      ).optional(),
      configuration: Joi.object().optional(),
      metadata: Joi.object().optional(),
    }).required();
  }

  static updateProfileSchema() {
    return Joi.object({
      displayName: Joi.string().trim().max(255).optional(),
      description: Joi.string().trim().optional().allow('', null),
      organization: Joi.string().trim().max(255).optional(),
      organizationDisplayName: Joi.string().trim().max(255).optional().allow('', null),
      department: Joi.string().trim().max(255).optional().allow('', null),
      url: Joi.string().trim().uri().optional(),
      checkinUrl: Joi.string().trim().uri().optional().allow('', null),
      topic: Joi.string().trim().optional().allow('', null),
      version: Joi.number().integer().min(1).optional(),
      isDefault: Joi.boolean().optional(),
      isActive: Joi.boolean().optional(),
      isMandatory: Joi.boolean().optional(),
      supervised: Joi.boolean().optional(),
      allowProfileRemoval: Joi.boolean().optional(),
      awaitDeviceConfigured: Joi.boolean().optional(),
      language: Joi.string().trim().max(10).optional().allow('', null),
      region: Joi.string().trim().max(10).optional().allow('', null),
      supportContact: Joi.string().trim().max(255).optional().allow('', null),
      supportEmail: Joi.string().email().optional().allow('', null),
      supportPhone: Joi.string().trim().max(50).optional().allow('', null),
      identityCertificateUuid: Joi.string().trim().optional().allow('', null),
      anchorCertificates: Joi.array().items(Joi.string()).optional(),
      skipSetupAssistantItems: Joi.array().items(
        Joi.string().valid(...SKIP_ITEMS_VALUES),
      ).optional(),
      configuration: Joi.object().optional(),
      metadata: Joi.object().optional(),
    })
      .min(1)
      .required();
  }

  static deviceProfileSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required(),
      udid: Joi.string().trim().optional().allow('', null),
    }).required();
  }

  static startEnrollmentSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required(),
      profileUuid: Joi.string().uuid().optional(),
      udid: Joi.string().trim().optional().allow('', null),
      model: Joi.string().trim().optional().allow('', null),
    }).required();
  }

  static updateEnrollmentStatusSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required(),
      status: Joi.string()
        .valid(...STATUS_VALUES)
        .required(),
      udid: Joi.string().trim().optional().allow('', null),
      model: Joi.string().trim().optional().allow('', null),
      metadata: Joi.object().optional(),
    }).required();
  }

  static recordEventSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required(),
      action: Joi.string().trim().required(),
      metadata: Joi.object().optional(),
      status: Joi.string().valid('success', 'failed').optional(),
    }).required();
  }

  static enrollmentListSchema() {
    return Joi.object({
      page: Joi.number().integer().min(1).default(1).optional(),
      limit: Joi.number().integer().min(1).max(100).default(10).optional(),
      status: Joi.string()
        .valid(...STATUS_VALUES)
        .optional(),
      serialNumber: Joi.string().trim().optional(),
    });
  }

  static profileListSchema() {
    return Joi.object({
      page: Joi.number().integer().min(1).default(1).optional(),
      limit: Joi.number().integer().min(1).max(100).default(10).optional(),
      isActive: Joi.boolean().optional(),
      isDefault: Joi.boolean().optional(),
    });
  }

  static deviceProfileDownloadSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required(),
    }).required();
  }

  static deviceConfiguredSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required(),
      udid: Joi.string().trim().optional().allow('', null),
      metadata: Joi.object().optional(),
    }).required();
  }

  static nanomdmEventSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().optional().allow('', null),
      udid: Joi.string().trim().optional().allow('', null),
      eventType: Joi.string().trim().required(),
      eventData: Joi.object().optional(),
      timestamp: Joi.date().iso().optional(),
    }).required();
  }

  static certificateSchema() {
    return Joi.object({
      certificateType: Joi.string().valid('identity', 'push', 'anchor').required(),
      displayName: Joi.string().trim().max(255).required(),
      uuid: Joi.string().trim().required(),
      topic: Joi.string().trim().optional().allow('', null),
      issuer: Joi.string().trim().optional().allow('', null),
      subject: Joi.string().trim().optional().allow('', null),
      serialNumber: Joi.string().trim().optional().allow('', null),
      notValidBefore: Joi.date().iso().optional().allow('', null),
      notValidAfter: Joi.date().iso().optional().allow('', null),
      thumbprint: Joi.string().trim().optional().allow('', null),
      isActive: Joi.boolean().optional(),
      metadata: Joi.object().optional(),
    }).required();
  }

  static updateCertificateSchema() {
    return Joi.object({
      displayName: Joi.string().trim().max(255).optional(),
      topic: Joi.string().trim().optional().allow('', null),
      issuer: Joi.string().trim().optional().allow('', null),
      subject: Joi.string().trim().optional().allow('', null),
      serialNumber: Joi.string().trim().optional().allow('', null),
      notValidBefore: Joi.date().iso().optional().allow('', null),
      notValidAfter: Joi.date().iso().optional().allow('', null),
      thumbprint: Joi.string().trim().optional().allow('', null),
      isActive: Joi.boolean().optional(),
      metadata: Joi.object().optional(),
    })
      .min(1)
      .required();
  }

  static abmSyncSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().optional(),
      deviceFamily: Joi.string().trim().optional().allow('', null),
      model: Joi.string().trim().optional().allow('', null),
      os: Joi.string().trim().optional().allow('', null),
      assignedAt: Joi.date().iso().optional().allow('', null),
      assignedServer: Joi.string().trim().optional().allow('', null),
      profileUuid: Joi.string().trim().optional().allow('', null),
      profileStatus: Joi.string().trim().optional().allow('', null),
      organization: Joi.string().trim().optional().allow('', null),
    }).required();
  }
}

module.exports = ADEValidator;
