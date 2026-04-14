const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', details = null) {
    super(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, details);
  }
}

module.exports = NotFoundError;
