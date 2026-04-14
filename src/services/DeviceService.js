const db = require('../models');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const logger = require('../utils/logger');

class DeviceService {
  /**
   * Get all devices
   */
  async getAllDevices(pagination) {
    const { limit = 10, offset = 0 } = pagination;

    const { count, rows } = await db.Device.findAndCountAll({
      limit,
      offset,
      include: [
        {
          model: db.Employee,
          include: [db.User],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return {
      data: rows.map((device) => this.formatDevice(device)),
      total: count,
      limit,
      offset,
    };
  }

  /**
   * Get device by ID
   */
  async getDeviceById(deviceId) {
    const device = await db.Device.findByPk(deviceId, {
      include: [
        {
          model: db.Employee,
          include: [db.User],
        },
        {
          model: db.DevicePolicy,
        },
        {
          model: db.NotificationLog,
          order: [['created_at', 'DESC']],
          limit: 10,
        },
      ],
    });

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    return this.formatDevice(device);
  }

  /**
   * Create device
   */
  async createDevice(deviceData) {
    const { employeeId, deviceIdentifier, deviceOs, deviceName } = deviceData;

    // Check if device identifier already exists
    const existingDevice = await db.Device.findOne({
      where: { device_identifier: deviceIdentifier },
    });

    if (existingDevice) {
      throw new ConflictError('Device identifier already exists');
    }

    // Verify employee exists
    const employee = await db.Employee.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    // Create device
    const device = await db.Device.create({
      employee_id: employeeId,
      device_identifier: deviceIdentifier,
      device_os: deviceOs,
      device_name: deviceName,
    });

    logger.info(`Device created: ${device.id}`);

    return this.formatDevice(device);
  }

  /**
   * Update camera status
   */
  async updateCameraStatus(deviceId, cameraBlocked) {
    const device = await db.Device.findByPk(deviceId);

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    const previousStatus = device.camera_blocked;
    await device.update({ camera_blocked: cameraBlocked });

    logger.info(
      `Device camera status updated: ${device.id} (${previousStatus} -> ${cameraBlocked})`,
    );

    return this.formatDevice(device);
  }

  /**
   * Delete device (soft delete)
   */
  async deleteDevice(deviceId) {
    const device = await db.Device.findByPk(deviceId);

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    await device.destroy(); // Soft delete

    logger.info(`Device deleted: ${device.id}`);
  }

  /**
   * Get device policies
   */
  async getDevicePolicies(deviceId) {
    const device = await db.Device.findByPk(deviceId);

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    const policies = await db.DevicePolicy.findAll({
      where: { device_id: deviceId },
      order: [['created_at', 'DESC']],
    });

    return policies.map((policy) => this.formatPolicy(policy));
  }

  /**
   * Format device data for response
   */
  formatDevice(device) {
    return {
      id: device.id,
      employeeId: device.employee_id,
      deviceIdentifier: device.device_identifier,
      deviceName: device.device_name,
      deviceOs: device.device_os,
      status: device.status,
      cameraBlocked: device.camera_blocked,
      lastSync: device.last_sync,
      deviceInfo: device.device_info,
      employee: device.Employee
        ? {
            id: device.Employee.id,
            employeeId: device.Employee.employee_id,
            user: device.Employee.User
              ? {
                  id: device.Employee.User.id,
                  username: device.Employee.User.username,
                  email: device.Employee.User.email,
                }
              : null,
          }
        : null,
      createdAt: device.created_at,
      updatedAt: device.updated_at,
    };
  }

  /**
   * Format policy data for response
   */
  formatPolicy(policy) {
    return {
      id: policy.id,
      deviceId: policy.device_id,
      policyType: policy.policy_type,
      policyDetails: policy.policy_details,
      isActive: policy.is_active,
      appliedAt: policy.applied_at,
      expiresAt: policy.expires_at,
      createdAt: policy.created_at,
      updatedAt: policy.updated_at,
    };
  }
}

module.exports = new DeviceService();
