const Joi = require('joi');

class ADEValidator {
  static deviceLookupSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required().messages({
        'string.empty': 'Serial number is required',
        'any.required': 'Serial number is required',
      }),
      model: Joi.string().trim().optional().allow('', null).messages({
        'string.empty': 'Model must be a string if provided',
      }),
      udid: Joi.string().trim().optional().allow('', null).messages({
        'string.empty': 'UDID must be a string if provided',
      }),
    }).required();
  }

  static createProfileSchema() {
    return Joi.object({
      displayName: Joi.string().trim().max(255).required().messages({
        'string.empty': 'Display name is required',
        'any.required': 'Display name is required',
      }),
      description: Joi.string().trim().optional().allow('', null),
      organization: Joi.string().trim().max(255).required().messages({
        'string.empty': 'Organization is required',
        'any.required': 'Organization is required',
      }),
      url: Joi.string().trim().uri().required().messages({
        'string.empty': 'Profile URL is required',
        'string.uri': 'Profile URL must be a valid URI',
        'any.required': 'Profile URL is required',
      }),
      version: Joi.number().integer().min(1).optional(),
      isDefault: Joi.boolean().optional(),
      isActive: Joi.boolean().optional(),
      configuration: Joi.object().optional(),
      metadata: Joi.object().optional(),
    }).required();
  }

  static updateProfileSchema() {
    return Joi.object({
      displayName: Joi.string().trim().max(255).optional(),
      description: Joi.string().trim().optional().allow('', null),
      organization: Joi.string().trim().max(255).optional(),
      url: Joi.string().trim().uri().optional(),
      version: Joi.number().integer().min(1).optional(),
      isDefault: Joi.boolean().optional(),
      isActive: Joi.boolean().optional(),
      configuration: Joi.object().optional(),
      metadata: Joi.object().optional(),
    })
      .min(1)
      .required();
  }

  static deviceProfileSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required().messages({
        'string.empty': 'Serial number is required',
        'any.required': 'Serial number is required',
      }),
      udid: Joi.string().trim().optional().allow('', null),
    }).required();
  }

  static startEnrollmentSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required().messages({
        'string.empty': 'Serial number is required',
        'any.required': 'Serial number is required',
      }),
      profileUuid: Joi.string().uuid().optional().messages({
        'string.guid': 'Profile UUID must be a valid UUID',
      }),
      udid: Joi.string().trim().optional().allow('', null),
      model: Joi.string().trim().optional().allow('', null),
    }).required();
  }

  static updateEnrollmentStatusSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required().messages({
        'string.empty': 'Serial number is required',
        'any.required': 'Serial number is required',
      }),
      status: Joi.string()
        .valid(
          'pending',
          'assigned',
          'enrollment_started',
          'checkin_received',
          'mdm_connection',
          'completed',
          'failed',
        )
        .required()
        .messages({
          'any.only': 'Invalid enrollment status',
          'any.required': 'Status is required',
        }),
      udid: Joi.string().trim().optional().allow('', null),
      model: Joi.string().trim().optional().allow('', null),
      metadata: Joi.object().optional(),
    }).required();
  }

  static recordEventSchema() {
    return Joi.object({
      serialNumber: Joi.string().trim().required().messages({
        'string.empty': 'Serial number is required',
        'any.required': 'Serial number is required',
      }),
      action: Joi.string().trim().required().messages({
        'string.empty': 'Action is required',
        'any.required': 'Action is required',
      }),
      metadata: Joi.object().optional(),
      status: Joi.string().valid('success', 'failed').optional(),
    }).required();
  }

  static enrollmentListSchema() {
    return Joi.object({
      page: Joi.number().integer().min(1).default(1).optional(),
      limit: Joi.number().integer().min(1).max(100).default(10).optional(),
      status: Joi.string()
        .valid(
          'pending',
          'assigned',
          'enrollment_started',
          'checkin_received',
          'mdm_connection',
          'completed',
          'failed',
        )
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
}

module.exports = ADEValidator;
