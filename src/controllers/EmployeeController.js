const EmployeeService = require('../services/EmployeeService');
const logger = require('../utils/logger');
const { formatResponse, paginate } = require('../utils/helpers');

class EmployeeController {
  async getAllEmployees(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const result = await EmployeeService.getAllEmployees(pagination);

      res.status(200).json(
        formatResponse(result.data, 'Employees retrieved successfully', {
          total: result.total,
          page: pagination.page,
          limit: pagination.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getEmployeeById(req, res, next) {
    try {
      const employee = await EmployeeService.getEmployeeById(req.params.id);

      res.status(200).json(
        formatResponse(employee, 'Employee retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async createEmployee(req, res, next) {
    try {
      const { userId, employeeId, department, deviceOs } = req.body;

      const employee = await EmployeeService.createEmployee({
        userId,
        employeeId,
        department,
        deviceOs,
      });

      res.status(201).json(
        formatResponse(employee, 'Employee created successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async updateEmployee(req, res, next) {
    try {
      const employee = await EmployeeService.updateEmployee(req.params.id, req.body);

      res.status(200).json(
        formatResponse(employee, 'Employee updated successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteEmployee(req, res, next) {
    try {
      await EmployeeService.deleteEmployee(req.params.id);

      res.status(200).json(
        formatResponse(null, 'Employee deleted successfully'),
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EmployeeController();
