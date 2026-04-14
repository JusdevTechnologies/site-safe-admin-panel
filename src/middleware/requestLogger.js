const logger = require('../utils/logger');

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const requestStart = Date.now();

  // Log request
  logger.info(`${req.method} ${req.originalUrl}`);

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const duration = Date.now() - requestStart;
    logger.debug(`Response: ${res.statusCode} (${duration}ms)`);
    return originalJson(data);
  };

  next();
};

module.exports = requestLogger;
