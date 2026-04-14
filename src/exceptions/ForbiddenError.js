const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden Access', details = null) {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, details);
  }
}

module.exports = ForbiddenError;
