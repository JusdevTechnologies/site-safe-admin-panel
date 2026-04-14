const UserService = require('../services/UserService');
const logger = require('../utils/logger');
const { formatResponse, paginate } = require('../utils/helpers');

class UserController {
  async getAllUsers(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const result = await UserService.getAllUsers(pagination);

      res.status(200).json(
        formatResponse(result.data, 'Users retrieved successfully', {
          total: result.total,
          page: pagination.page,
          limit: pagination.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req, res, next) {
    try {
      const user = await UserService.getUserById(req.params.id);

      res.status(200).json(
        formatResponse(user, 'User retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async createUser(req, res, next) {
    try {
      const { username, email, password, firstName, lastName, role } = req.body;

      const user = await UserService.createUser({
        username,
        email,
        password,
        firstName,
        lastName,
        role,
      });

      res.status(201).json(
        formatResponse(user, 'User created successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const user = await UserService.updateUser(req.params.id, req.body);

      res.status(200).json(
        formatResponse(user, 'User updated successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req, res, next) {
    try {
      const { status } = req.body;

      const user = await UserService.updateUserStatus(req.params.id, status);

      res.status(200).json(
        formatResponse(user, 'User status updated successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      await UserService.deleteUser(req.params.id);

      res.status(200).json(
        formatResponse(null, 'User deleted successfully'),
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
