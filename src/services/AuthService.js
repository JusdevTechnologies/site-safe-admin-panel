const db = require('../models');
const { generateTokenPair, generateToken } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/hasher');
const UnauthorizedError = require('../exceptions/UnauthorizedError');
const ConflictError = require('../exceptions/ConflictError');
const { USER_ROLES, USER_STATUS } = require('../constants');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register new user
   */
  async register(userData) {
    const { username, email, password, firstName, lastName } = userData;

    // Check if user already exists
    const existingUser = await db.User.findOne({
      where: {
        [db.Sequelize.Op.or]: [{ username }, { email }],
      },
    });

    if (existingUser) {
      throw new ConflictError('Username or email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await db.User.create({
      username,
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: USER_ROLES.VIEWER, // Default role
      status: USER_STATUS.ACTIVE,
    });

    logger.info(`User registered: ${user.id}`);

    // Generate tokens
    const tokens = generateTokenPair({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.formatUser(user),
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login(username, password) {
    const user = await db.User.findOne({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check user status
    if (user.status !== USER_STATUS.ACTIVE) {
      throw new UnauthorizedError(`Account is ${user.status}`);
    }

    // Update last login
    await user.update({ last_login: new Date() });

    logger.info(`User logged in: ${user.id}`);

    // Generate tokens
    const tokens = generateTokenPair({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.formatUser(user),
      ...tokens,
    };
  }

  /**
   * Admin login - Super admin only
   */
  async adminLogin(username, password) {
    const user = await db.User.findOne({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if user is super admin
    if (user.role !== 'super_admin') {
      throw new UnauthorizedError('Access denied. Super admin role required.');
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check user status
    if (user.status !== USER_STATUS.ACTIVE) {
      throw new UnauthorizedError(`Account is ${user.status}`);
    }

    // Update last login
    await user.update({ last_login: new Date() });

    logger.info(`Admin user logged in: ${user.id}`);

    // Generate tokens
    const tokens = generateTokenPair({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.formatUser(user),
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = require('../utils/jwt').verifyToken(refreshToken);

      const user = await db.User.findByPk(decoded.id);

      if (!user || user.status !== USER_STATUS.ACTIVE) {
        throw new UnauthorizedError('Invalid refresh token or user inactive');
      }

      const tokens = generateTokenPair({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return this.formatUser(user);
  }

  /**
   * Format user data for response
   */
  formatUser(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
      lastLogin: user.last_login,
      createdAt: user.created_at,
    };
  }
}

module.exports = new AuthService();
