const db = require('../models');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const logger = require('../utils/logger');

class EmployeeService {
  /**
   * Get all employees
   */
  async getAllEmployees(pagination) {
    const { limit = 10, offset = 0 } = pagination;

    const { count, rows } = await db.Employee.findAndCountAll({
      limit,
      offset,
      include: [
        {
          model: db.User,
          attributes: ['id', 'username', 'email', 'first_name', 'last_name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return {
      data: rows.map((emp) => this.formatEmployee(emp)),
      total: count,
      limit,
      offset,
    };
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(employeeId) {
    const employee = await db.Employee.findByPk(employeeId, {
      include: [
        {
          model: db.User,
          attributes: ['id', 'username', 'email', 'first_name', 'last_name'],
        },
        {
          model: db.Device,
          attributes: ['id', 'device_identifier', 'device_name', 'device_os', 'camera_blocked'],
        },
      ],
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    return this.formatEmployee(employee);
  }

  /**
   * Create new employee
   */
  async createEmployee(employeeData) {
    const { userId, employeeId, department, deviceOs } = employeeData;

    // Check if employee ID already exists
    const existingEmployee = await db.Employee.findOne({
      where: { employee_id: employeeId },
    });

    if (existingEmployee) {
      throw new ConflictError('Employee ID already exists');
    }

    // Verify user exists
    const user = await db.User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Create employee
    const employee = await db.Employee.create({
      user_id: userId,
      employee_id: employeeId,
      department,
      device_os: deviceOs,
    });

    logger.info(`Employee created: ${employee.id}`);

    return this.formatEmployee(employee);
  }

  /**
   * Update employee
   */
  async updateEmployee(employeeId, updateData) {
    const employee = await db.Employee.findByPk(employeeId, {
      include: [db.User],
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const { department, deviceOs, status } = updateData;

    const updatePayload = {};

    if (department !== undefined) updatePayload.department = department;
    if (deviceOs !== undefined) updatePayload.device_os = deviceOs;
    if (status !== undefined) updatePayload.status = status;

    await employee.update(updatePayload);

    logger.info(`Employee updated: ${employee.id}`);

    return this.formatEmployee(employee);
  }

  /**
   * Delete employee (soft delete)
   */
  async deleteEmployee(employeeId) {
    const employee = await db.Employee.findByPk(employeeId);

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    await employee.destroy(); // Soft delete

    logger.info(`Employee deleted: ${employee.id}`);
  }

  /**
   * Format employee data for response
   */
  formatEmployee(employee) {
    return {
      id: employee.id,
      employeeId: employee.employee_id,
      userId: employee.user_id,
      user: employee.User ? {
        id: employee.User.id,
        username: employee.User.username,
        email: employee.User.email,
        firstName: employee.User.first_name,
        lastName: employee.User.last_name,
      } : null,
      department: employee.department,
      deviceOs: employee.device_os,
      status: employee.status,
      devices: employee.Devices
        ? employee.Devices.map((device) => ({
          id: device.id,
          identifier: device.device_identifier,
          name: device.device_name,
          os: device.device_os,
          cameraBl locked: device.camera_blocked,
        }))
        : [],
      createdAt: employee.created_at,
      updatedAt: employee.updated_at,
    };
  }
}

module.exports = new EmployeeService();
