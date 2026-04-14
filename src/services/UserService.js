const db = require('../models');
const { hashPassword } = require('../utils/hasher');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const { USER_STATUS, USER_ROLES } = require('../constants');
const logger = require('../utils/logger');

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
