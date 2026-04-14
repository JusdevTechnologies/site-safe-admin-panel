const { HTTP_STATUS, ERROR_CODES } = require('./index');

/**
 * AppError - Base application error class
 * All custom errors should extend this class
 */
class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.errorCode,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

module.exports = AppError;
