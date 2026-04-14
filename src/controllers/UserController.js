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

  /**
   * Get admin users list with search and filtering
   * GET /api/v1/admin/users
   */
  async getAdminUsersList(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit || 20);
      const filters = {
        search: req.query.search,
        status: req.query.status,
        role: req.query.role, // 'super_admin' or 'admin'
      };

      const result = await UserService.getAdminUsersList(pagination, filters);

      res.status(200).json(
        formatResponse(result.data, 'Admin users list retrieved successfully', {
          total: result.total,
          page: result.page,
          limit: result.limit,
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

  /**
   * Create admin user
   * POST /api/v1/admin/users
   */
  async createAdminUser(req, res, next) {
    try {
      const {
        username, email, password, firstName, lastName, role,
      } = req.body;

      const user = await UserService.createAdminUser({
        username,
        email,
        password,
        firstName,
        lastName,
        role,
      });

      res.status(201).json(
        formatResponse(user, 'Admin user created successfully'),
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

  /**
   * Update admin user
   * PATCH /api/v1/admin/users/:id
   */
  async updateAdminUser(req, res, next) {
    try {
      const user = await UserService.updateUser(req.params.id, req.body);

      res.status(200).json(
        formatResponse(user, 'Admin user updated successfully'),
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

  /**
   * Delete admin user
   * DELETE /api/v1/admin/users/:id
   */
  async deleteAdminUser(req, res, next) {
    try {
      await UserService.deleteUser(req.params.id);

      res.status(200).json(
        formatResponse(null, 'Admin user deleted successfully'),
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
