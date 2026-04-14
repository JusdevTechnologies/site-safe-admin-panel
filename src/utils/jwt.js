const jwt = require('jsonwebtoken');
const environment = require('../../config/environment');

/**
 * Generate JWT token
 */
const generateToken = (payload, expiresIn = environment.jwt.accessTokenExpiresIn) => {
  return jwt.sign(payload, environment.jwt.secret, {
    expiresIn,
    algorithm: 'HS256',
  });
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, environment.jwt.secret, {
      algorithms: ['HS256'],
    });
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Decode JWT token without verification (use carefully)
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Generate both access and refresh tokens
 */
const generateTokenPair = (payload) => {
  const accessToken = generateToken(
    payload,
    environment.jwt.accessTokenExpiresIn,
  );
  const refreshToken = generateToken(
    payload,
    environment.jwt.refreshTokenExpiresIn,
  );

  return {
    accessToken,
    refreshToken,
  };
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  generateTokenPair,
};
