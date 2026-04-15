const Joi = require('joi');

/**
 * Admin Panel Validators
 * All validators follow Joi schema patterns for consistency
 */

class AdminValidator {
  /**
   * Validate admin login request
   */
  static loginSchema() {
    return Joi.object({
      username: Joi.string().min(3).max(50).required().messages({
        'string.empty': 'Username is required',
        'string.min': 'Username must be at least 3 characters',
      }),
      password: Joi.string().min(6).required().messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 6 characters',
      }),
    }).required();
  }

  /**
   * Validate admin refresh token request
   */
  static refreshTokenSchema() {
    return Joi.object({
      refreshToken: Joi.string().required().messages({
        'string.empty': 'Refresh token is required',
      }),
    }).required();
  }

  /**
   * Validate device block/unblock request
   */
  static deviceActionSchema() {
    return Joi.object({
      deviceId: Joi.string().uuid().required().messages({
        'string.guid': 'Invalid device ID',
        'any.required': 'Device ID is required',
      }),
      reason: Joi.string().max(500).optional().messages({
        'string.max': 'Reason must not exceed 500 characters',
      }),
    }).required();
  }

  /**
   * Validate OTP generation request
   */
  static generateOtpSchema() {
    return Joi.object({
      deviceId: Joi.string().uuid().required().messages({
        'string.guid': 'Invalid device ID',
        'any.required': 'Device ID is required',
      }),
    }).required();
  }

  /**
   * Validate user creation request
   */
  static createUserSchema() {
    return Joi.object({
      username: Joi.string().alphanum().min(3).max(50).required().messages({
        'string.empty': 'Username is required',
        'string.alphanum': 'Username must contain only alphanumeric characters',
        'string.min': 'Username must be at least 3 characters',
        'string.max': 'Username must not exceed 50 characters',
      }),
      email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
      password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain uppercase, lowercase, and numbers',
      }),
      firstName: Joi.string().max(50).optional().messages({
        'string.max': 'First name must not exceed 50 characters',
      }),
      lastName: Joi.string().max(50).optional().messages({
        'string.max': 'Last name must not exceed 50 characters',
      }),
      role: Joi.string().valid('super_admin', 'admin').required().messages({
        'any.only': 'Role must be either super_admin or admin',
        'any.required': 'Role is required',
      }),
    }).required();
  }

  /**
   * Validate user update request
   */
  static updateUserSchema() {
    return Joi.object({
      firstName: Joi.string().max(50).optional().messages({
        'string.max': 'First name must not exceed 50 characters',
      }),
      lastName: Joi.string().max(50).optional().messages({
        'string.max': 'Last name must not exceed 50 characters',
      }),
      email: Joi.string().email().optional().messages({
        'string.email': 'Please provide a valid email address',
      }),
      password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).optional().messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain uppercase, lowercase, and numbers',
      }),
      status: Joi.string().valid('active', 'inactive', 'suspended').optional().messages({
        'any.only': 'Status must be active, inactive, or suspended',
      }),
      role: Joi.string().valid('super_admin', 'admin').optional().messages({
        'any.only': 'Role must be either super_admin or admin',
      }),
    }).min(1).required();
  }

  /**
   * Validate employee creation request
   */
  static createEmployeeSchema() {
    return Joi.object({
      employeeId: Joi.string().max(50).required().messages({
        'string.empty': 'Employee ID is required',
        'string.max': 'Employee ID must not exceed 50 characters',
      }),
      firstName: Joi.string().max(100).required().messages({
        'string.empty': 'First name is required',
        'string.max': 'First name must not exceed 100 characters',
      }),
      lastName: Joi.string().max(100).optional().allow('', null).messages({
        'string.max': 'Last name must not exceed 100 characters',
      }),
      email: Joi.string().email().optional().allow('', null).messages({
        'string.email': 'Please provide a valid email address',
      }),
      phone: Joi.string().max(30).optional().allow('', null).messages({
        'string.max': 'Phone must not exceed 30 characters',
      }),
      department: Joi.string().max(100).optional().allow('', null).messages({
        'string.max': 'Department must not exceed 100 characters',
      }),
      deviceOs: Joi.string().valid('android', 'ios').required().messages({
        'any.only': 'Device OS must be android or ios',
        'any.required': 'Device OS is required',
      }),
    }).required();
  }

  /**
   * Validate employee update request
   */
  static updateEmployeeSchema() {
    return Joi.object({
      firstName: Joi.string().max(100).optional().messages({
        'string.max': 'First name must not exceed 100 characters',
      }),
      lastName: Joi.string().max(100).optional().allow('', null).messages({
        'string.max': 'Last name must not exceed 100 characters',
      }),
      email: Joi.string().email().optional().allow('', null).messages({
        'string.email': 'Please provide a valid email address',
      }),
      phone: Joi.string().max(30).optional().allow('', null).messages({
        'string.max': 'Phone must not exceed 30 characters',
      }),
      department: Joi.string().max(100).optional().allow('', null).messages({
        'string.max': 'Department must not exceed 100 characters',
      }),
      deviceOs: Joi.string().valid('android', 'ios').optional().messages({
        'any.only': 'Device OS must be android or ios',
      }),
      status: Joi.string().valid('active', 'inactive').optional().messages({
        'any.only': 'Status must be active or inactive',
      }),
    }).min(1).required();
  }

  /**
   * Validate pagination and search parameters
   */
  static paginationSchema() {
    return Joi.object({
      page: Joi.number().integer().min(1).default(1).optional(),
      limit: Joi.number().integer().min(1).max(100).default(10).optional(),
      search: Joi.string().max(100).optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional(),
    });
  }

  /**
   * Validate dashboard date range filters
   */
  static dashboardFiltersSchema() {
    return Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().optional(),
      deviceStatus: Joi.string().valid('active', 'inactive', 'blocked', 'lost').optional(),
    });
  }
}

module.exports = AdminValidator;
