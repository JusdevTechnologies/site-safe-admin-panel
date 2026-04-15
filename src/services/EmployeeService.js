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
          model: db.Device,
          attributes: ['id', 'device_identifier', 'device_name', 'device_os', 'camera_blocked', 'status'],
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
    const { employeeId, firstName, lastName, email, phone, department, deviceOs } = employeeData;

    // Check if employee ID already exists
    const existingEmployee = await db.Employee.findOne({
      where: { employee_id: employeeId },
    });

    if (existingEmployee) {
      throw new ConflictError('Employee ID already exists');
    }

    const employee = await db.Employee.create({
      employee_id: employeeId,
      first_name: firstName,
      last_name: lastName || null,
      email: email || null,
      phone: phone || null,
      department: department || null,
      device_os: deviceOs,
    });

    logger.info(`Employee created: ${employee.id} (${employee.employee_id})`);

    return this.formatEmployee(employee);
  }

  /**
   * Update employee
   */
  async updateEmployee(employeeId, updateData) {
    const employee = await db.Employee.findByPk(employeeId);

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const { firstName, lastName, email, phone, department, deviceOs, status } = updateData;

    const updatePayload = {};

    if (firstName !== undefined) updatePayload.first_name = firstName;
    if (lastName !== undefined) updatePayload.last_name = lastName;
    if (email !== undefined) updatePayload.email = email;
    if (phone !== undefined) updatePayload.phone = phone;
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

    await employee.destroy();

    logger.info(`Employee deleted: ${employee.id}`);
  }

  /**
   * Format employee data for response
   */
  formatEmployee(employee) {
    return {
      id: employee.id,
      employeeId: employee.employee_id,
      firstName: employee.first_name,
      lastName: employee.last_name,
      email: employee.email,
      phone: employee.phone,
      department: employee.department,
      deviceOs: employee.device_os,
      status: employee.status,
      devices: employee.Devices
        ? employee.Devices.map((device) => ({
            id: device.id,
            identifier: device.device_identifier,
            name: device.device_name,
            os: device.device_os,
            status: device.status,
            cameraBlocked: device.camera_blocked,
          }))
        : [],
      createdAt: employee.created_at,
      updatedAt: employee.updated_at,
    };
  }
}

module.exports = new EmployeeService();
