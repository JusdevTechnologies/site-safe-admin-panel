const ForbiddenError = require('../exceptions/ForbiddenError');
const { USER_ROLES } = require('../constants');

/**
 * Authorization middleware
 * Checks if user has required role(s)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
        ),
      );
    }

    next();
  };
};

module.exports = authorize;
