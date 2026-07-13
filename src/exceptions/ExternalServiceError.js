const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class ExternalServiceError extends AppError {
  constructor(message = 'External Service Error', details = null) {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.EXTERNAL_SERVICE_ERROR, details);
  }
}

module.exports = ExternalServiceError;
