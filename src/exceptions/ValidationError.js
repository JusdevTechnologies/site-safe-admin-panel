const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class ValidationError extends AppError {
  constructor(message = 'Validation Error', details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

module.exports = ValidationError;
