const Joi = require('joi');
const ValidationError = require('../exceptions/ValidationError');

/**
 * Mobile App Validators
 * Validates incoming requests for mobile app APIs
 */

class MobileValidator {
  /**
   * Validate device registration request
   * @param {Object} data - Request body
   * @throws {ValidationError} - If validation fails
   */
  static validateDeviceRegistration(data) {
    const schema = Joi.object({
      employee_id: Joi.string()
        .trim()
        .min(3)
        .max(50)
        .pattern(/^[A-Za-z0-9_-]+$/)
        .required()
        .messages({
          'string.empty': 'Employee ID is required',
          'string.min': 'Employee ID must be at least 3 characters',
          'string.max': 'Employee ID must not exceed 50 characters',
          'string.pattern.base':
            'Employee ID can only contain letters, numbers, underscores, and hyphens',
          'any.required': 'Employee ID is required',
        }),
      device_identifier: Joi.string().trim().min(5).max(255).required().messages({
        'string.empty': 'Device identifier cannot be empty',
        'string.min': 'Device identifier must be at least 5 characters',
        'string.max': 'Device identifier must not exceed 255 characters',
        'any.required': 'Device identifier is required',
      }),
      device_os: Joi.string().valid('android', 'ios').required().messages({
        'any.only': 'Device OS must be either "android" or "ios"',
        'any.required': 'Device OS is required',
      }),
      device_name: Joi.string().trim().max(255).optional().messages({
        'string.max': 'Device name must not exceed 255 characters',
      }),
      push_notification_token: Joi.string().trim().min(10).required().messages({
        'string.empty': 'Push notification token cannot be empty',
        'string.min': 'Push notification token format is invalid',
        'any.required': 'Push notification token is required',
      }),
      notification_platform: Joi.string().valid('fcm', 'apns').required().messages({
        'any.only': 'Notification platform must be either "fcm" (Android) or "apns" (iOS)',
        'any.required': 'Notification platform is required',
      }),
    });

    const { error, value } = schema.validate(data, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    return value;
  }

  /**
   * Validate OTP request
   * @param {Object} data - Request body
   * @throws {ValidationError} - If validation fails
   */
  static validateOTPRequest(data) {
    const schema = Joi.object({
      device_identifier: Joi.string().trim().min(5).max(255).required().messages({
        'string.empty': 'Device identifier cannot be empty',
        'string.min': 'Device identifier must be at least 5 characters',
        'string.max': 'Device identifier must not exceed 255 characters',
        'any.required': 'Device identifier is required',
      }),
    });

    const { error, value } = schema.validate(data, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    return value;
  }

  /**
   * Validate OTP verification request
   * @param {Object} data - Request body
   * @throws {ValidationError} - If validation fails
   */
  static validateOTPVerification(data) {
    const schema = Joi.object({
      device_identifier: Joi.string().trim().min(5).max(255).required().messages({
        'string.empty': 'Device identifier cannot be empty',
        'string.min': 'Device identifier must be at least 5 characters',
        'string.max': 'Device identifier must not exceed 255 characters',
        'any.required': 'Device identifier is required',
      }),
      otp_code: Joi.string().trim().length(8).pattern(/^\d+$/).required().messages({
        'string.empty': 'OTP code cannot be empty',
        'string.length': 'OTP code must be exactly 8 digits',
        'string.pattern.base': 'OTP code must contain only digits',
        'any.required': 'OTP code is required',
      }),
    });

    const { error, value } = schema.validate(data, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    return value;
  }

  /**
   * Validate device status request
   * @param {Object} data - Request params
   * @throws {ValidationError} - If validation fails
   */
  static validateDeviceStatusRequest(deviceIdentifier) {
    const schema = Joi.string().trim().min(5).max(255).required();

    const { error, value } = schema.validate(deviceIdentifier, {
      abortEarly: true,
    });

    if (error) {
      throw new ValidationError('Device identifier is invalid');
    }

    return value;
  }

  /**
   * Validate punch-in / punch-out record request
   * @param {Object} data - Request body
   * @throws {ValidationError} - If validation fails
   */
  static validatePunchRecord(data) {
    const schema = Joi.object({
      device_identifier: Joi.string().trim().min(5).max(255).required().messages({
        'string.empty': 'Device identifier cannot be empty',
        'string.min': 'Device identifier must be at least 5 characters',
        'string.max': 'Device identifier must not exceed 255 characters',
        'any.required': 'Device identifier is required',
      }),
      punch_type: Joi.string().valid('punch_in', 'punch_out').required().messages({
        'any.only': 'punch_type must be either "punch_in" or "punch_out"',
        'any.required': 'punch_type is required',
      }),
      location: Joi.string().trim().max(255).optional().allow(null, '').messages({
        'string.max': 'Location must not exceed 255 characters',
      }),
      external_id: Joi.string().trim().max(255).optional().allow(null, '').messages({
        'string.max': 'external_id must not exceed 255 characters',
      }),
    });

    const { error, value } = schema.validate(data, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    return value;
  }
}

module.exports = MobileValidator;
