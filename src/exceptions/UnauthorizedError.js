const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized Access', details = null) {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, details);
  }
}

module.exports = UnauthorizedError;
