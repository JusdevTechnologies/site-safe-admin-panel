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
      employee_id: Joi.string().uuid().required().messages({
        'string.guid': 'Invalid employee ID format',
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
      otp_code: Joi.string()
        .trim()
        .length(8)
        .pattern(/^\d+$/)
        .required()
        .messages({
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
}

module.exports = MobileValidator;
