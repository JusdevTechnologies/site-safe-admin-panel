const logger = require('../utils/logger');
const AppError = require('../exceptions/AppError');
const { formatErrorResponse } = require('../utils/helpers');

/**
 * Global error handling middleware
 * Must be registered last in the middleware stack
 */
const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Handle Joi validation errors
  if (err.error && err.error.details) {
    return res.status(400).json(
      formatErrorResponse(
        'Validation Error',
        'VALIDATION_ERROR',
        400,
        err.error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      ),
    );
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      formatErrorResponse(
        'Invalid Token',
        'INVALID_TOKEN',
        401,
      ),
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      formatErrorResponse(
        'Token Expired',
        'TOKEN_EXPIRED',
        401,
      ),
    );
  }

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json(
      formatErrorResponse(
        'Validation Error',
        'VALIDATION_ERROR',
        400,
        err.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      ),
    );
  }

  // Handle Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json(
      formatErrorResponse(
        'Duplicate Record',
        'DUPLICATE_RECORD',
        409,
        err.errors.map((e) => ({
          field: e.path,
          message: `${e.path} already exists`,
        })),
      ),
    );
  }

  // Handle unknown errors
  return res.status(500).json(
    formatErrorResponse(
      'Internal Server Error',
      'INTERNAL_SERVER_ERROR',
      500,
    ),
  );
};

module.exports = errorHandler;
