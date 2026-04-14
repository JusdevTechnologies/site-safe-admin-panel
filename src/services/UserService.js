const db = require('../models');
const { hashPassword } = require('../utils/hasher');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const { USER_STATUS, USER_ROLES } = require('../constants');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class UserService {
  /**
   * Get all users
   */
  async getAllUsers(pagination) {
    const { limit = 10, offset = 0 } = pagination;

    const { count, rows } = await db.User.findAndCountAll({
      limit,
      offset,
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password_hash'] },
    });

    return {
      data: rows.map((user) => this.formatUser(user)),
      total: count,
      limit,
      offset,
    };
  }

  /**
   * Get admin users list with search and filtering
   * Only returns super_admin and admin users
   */
  async getAdminUsersList(pagination, filters = {}) {
    try {
      const { page = 1, limit = 20, offset = 0 } = pagination;
      const where = {
        role: {
          [Op.in]: ['super_admin', 'admin'],
        },
        deleted_at: null,
      };

      // Apply search filter
      if (filters.search) {
        where[Op.or] = [
          { username: { [Op.iLike]: `%${filters.search}%` } },
          { email: { [Op.iLike]: `%${filters.search}%` } },
          { first_name: { [Op.iLike]: `%${filters.search}%` } },
          { last_name: { [Op.iLike]: `%${filters.search}%` } },
        ];
      }

      // Apply status filter
      if (filters.status) {
        where.status = filters.status;
      }

      // Apply role filter
      if (filters.role) {
        where.role = filters.role;
      }

      const { count, rows } = await db.User.findAndCountAll({
        where,
        attributes: { exclude: ['password_hash'] },
        order: [['created_at', 'DESC']],
        limit,
        offset,
        subQuery: false,
      });

      return {
        data: rows.map((user) => this.formatUser(user)),
        total: count,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`Error getting admin users list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await db.User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.formatUser(user);
  }

  /**
   * Create new admin user (CRUD operation for super admin)
   */
  async createAdminUser(userData) {
    const { username, email, password, firstName, lastName, role = 'admin' } = userData;

    // Validate role - only allow admin and super_admin roles
    if (!['super_admin', 'admin'].includes(role)) {
      throw new ConflictError('Invalid role. Must be super_admin or admin');
    }

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
      role,
      status: USER_STATUS.ACTIVE,
    });

    logger.info(`Admin user created: ${user.id} with role ${role}`);

    return this.formatUser(user);
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    const { username, email, password, firstName, lastName, role = USER_ROLES.VIEWER } = userData;

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
      role,
      status: USER_STATUS.ACTIVE,
    });

    logger.info(`User created: ${user.id}`);

    return this.formatUser(user);
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { firstName, lastName, role, password } = updateData;

    const updatePayload = {};

    if (firstName !== undefined) updatePayload.first_name = firstName;
    if (lastName !== undefined) updatePayload.last_name = lastName;
    if (role !== undefined) updatePayload.role = role;
    if (password !== undefined) {
      updatePayload.password_hash = await hashPassword(password);
    }

    await user.update(updatePayload);

    logger.info(`User updated: ${user.id}`);

    return this.formatUser(user);
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId, status) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.update({ status });

    logger.info(`User status updated: ${user.id} -> ${status}`);

    return this.formatUser(user);
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.destroy(); // Soft delete

    logger.info(`User deleted: ${user.id}`);
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
      updatedAt: user.updated_at,
    };
  }
}

module.exports = new UserService();
