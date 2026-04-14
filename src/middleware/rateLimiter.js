const rateLimit = require('express-rate-limit');
const environment = require('../../config/environment');

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: environment.rateLimit.windowMs,
  max: environment.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // disable the `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful requests
});

module.exports = {
  apiLimiter,
  authLimiter,
};
