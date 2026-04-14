const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class ConflictError extends AppError {
  constructor(message = 'Resource Conflict', details = null) {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.DUPLICATE_RECORD, details);
  }
}

module.exports = ConflictError;
