const UnauthorizedError = require('../exceptions/UnauthorizedError');
const { verifyToken } = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = verifyToken(token);
    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    logger.warn(`Authentication failed: ${error.message}`);
    next(new UnauthorizedError('Authentication failed', null));
  }
};

module.exports = authenticate;
