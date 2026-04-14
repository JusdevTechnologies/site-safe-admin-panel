const AuthService = require('../services/AuthService');
const logger = require('../utils/logger');
const { formatResponse } = require('../utils/helpers');

class AuthController {
  async register(req, res, next) {
    try {
      const { username, email, password, firstName, lastName } = req.body;

      const result = await AuthService.register({
        username,
        email,
        password,
        firstName,
        lastName,
      });

      res.status(201).json(
        formatResponse(result, 'User registered successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      const result = await AuthService.login(username, password);

      res.status(200).json(
        formatResponse(result, 'Login successful'),
      );
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      const tokens = await AuthService.refreshToken(refreshToken);

      res.status(200).json(
        formatResponse(tokens, 'Token refreshed successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      // Token invalidation can be handled by client-side deletion or using a blacklist
      res.status(200).json(
        formatResponse(null, 'Logout successful'),
      );
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      const user = await AuthService.getCurrentUser(req.user.id);

      res.status(200).json(
        formatResponse(user, 'User retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
