const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');

/**
 * Generate a UUID
 */
const generateUUID = () => uuidv4();

/**
 * Check if a value is a valid UUID
 */
const isValidUUID = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Parse boolean from string
 */
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
};

/**
 * Sanitize object - remove null, undefined, empty strings
 */
const sanitizeObject = (obj) => {
  return _.pickBy(obj, (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
  });
};

/**
 * Pick only specified fields from object
 */
const pickFields = (obj, fields) => {
  return _.pick(obj, fields);
};

/**
 * Omit specified fields from object
 */
const omitFields = (obj, fields) => {
  return _.omit(obj, fields);
};

/**
 * Format date to ISO string
 */
const formatDate = (date) => {
  return new Date(date).toISOString();
};

/**
 * Paginate results
 */
const paginate = (page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  return {
    page: pageNum,
    limit: limitNum,
    offset,
  };
};

/**
 * Format API response
 */
const formatResponse = (data, message = 'Success', meta = null) => {
  return {
    success: true,
    message,
    data,
    ...(meta && { meta }),
  };
};

/**
 * Format error response
 */
const formatErrorResponse = (message, code = 'ERROR', statusCode = 500, details = null) => {
  return {
    success: false,
    error: {
      message,
      code,
      statusCode,
      ...(details && { details }),
    },
  };
};

/**
 * Generate random OTP code
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - Random OTP code
 */
const generateRandomOTP = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

/**
 * Calculate OTP expiry time
 * @param {number} minutes - Expiry time in minutes (default: 5)
 * @returns {Date} - Expiry timestamp
 */
const calculateOTPExpiry = (minutes = 5) => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now;
};

module.exports = {
  generateUUID,
  isValidUUID,
  parseBoolean,
  sanitizeObject,
  pickFields,
  omitFields,
  formatDate,
  paginate,
  formatResponse,
  formatErrorResponse,
  generateRandomOTP,
  calculateOTPExpiry,
};
