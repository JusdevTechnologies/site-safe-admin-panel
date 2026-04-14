const db = require('../models');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class DeviceService {
  /**
   * Get all devices (mobile endpoint)
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
   * Get all devices for admin panel with search and pagination
   */
  async getAdminDeviceList(pagination, filters = {}) {
    try {
      const { page = 1, limit = 20, offset = 0 } = pagination;
      const where = { deleted_at: null };

      // Apply search filter
      if (filters.search) {
        where[Op.or] = [
          { device_identifier: { [Op.iLike]: `%${filters.search}%` } },
          { device_name: { [Op.iLike]: `%${filters.search}%` } },
          db.sequelize.where(
            db.sequelize.col('Employee.employee_id'),
            Op.iLike,
            `%${filters.search}%`,
          ),
        ];
      }

      // Apply status filter
      if (filters.status) {
        where.status = filters.status;
      }

      // Apply camera blocked filter
      if (filters.cameraBlockedFilter !== undefined) {
        where.camera_blocked = filters.cameraBlockedFilter;
      }

      // Apply OS filter
      if (filters.os) {
        where.device_os = filters.os;
      }

      const { count, rows } = await db.Device.findAndCountAll({
        where,
        include: [
          {
            model: db.Employee,
            attributes: ['id', 'employee_id', 'department', 'device_os'],
            include: [
              {
                model: db.User,
                attributes: ['id', 'username', 'first_name', 'last_name', 'email'],
              },
            ],
          },
          {
            model: db.User,
            as: 'blockedByUser',
            attributes: ['id', 'username', 'first_name', 'last_name'],
            required: false,
          },
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset,
        subQuery: false,
      });

      return {
        data: rows.map((device) => this.formatDeviceForAdmin(device)),
        total: count,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`Error getting admin device list: ${error.message}`);
      throw error;
    }
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
   * Block device camera (admin action)
   */
  async blockDeviceCamera(deviceId, userId, reason = null) {
    try {
      const device = await db.Device.findByPk(deviceId);

      if (!device) {
        throw new NotFoundError('Device not found');
      }

      if (device.camera_blocked) {
        throw new ConflictError('Device camera is already blocked');
      }

      // Update device with block info
      await device.update({
        camera_blocked: true,
        camera_blocked_by: userId,
        camera_blocked_at: new Date(),
      });

      // Create audit log
      await db.AuditLog.create({
        user_id: userId,
        action: 'device_camera_blocked',
        entity_type: 'device',
        entity_id: deviceId,
        changes: {
          camera_blocked: { from: false, to: true },
          reason,
        },
        status: 'success',
      });

      logger.info(`Device camera blocked: ${deviceId} by user ${userId}`);

      return this.formatDeviceForAdmin(device);
    } catch (error) {
      logger.error(`Error blocking device camera: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unblock device camera (admin action)
   */
  async unblockDeviceCamera(deviceId, userId, reason = null) {
    try {
      const device = await db.Device.findByPk(deviceId);

      if (!device) {
        throw new NotFoundError('Device not found');
      }

      if (!device.camera_blocked) {
        throw new ConflictError('Device camera is already unblocked');
      }

      // Update device with unblock info
      await device.update({
        camera_blocked: false,
        camera_blocked_by: null,
        camera_blocked_at: null,
      });

      // Create audit log
      await db.AuditLog.create({
        user_id: userId,
        action: 'device_camera_unblocked',
        entity_type: 'device',
        entity_id: deviceId,
        changes: {
          camera_blocked: { from: true, to: false },
          reason,
        },
        status: 'success',
      });

      logger.info(`Device camera unblocked: ${deviceId} by user ${userId}`);

      return this.formatDeviceForAdmin(device);
    } catch (error) {
      logger.error(`Error unblocking device camera: ${error.message}`);
      throw error;
    }
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
   * Format device data for admin panel response
   */
  formatDeviceForAdmin(device) {
    return {
      id: device.id,
      employeeId: device.employee_id,
      deviceIdentifier: device.device_identifier,
      deviceName: device.device_name,
      deviceOs: device.device_os,
      status: device.status,
      cameraBlocked: device.camera_blocked,
      cameraBlockedAt: device.camera_blocked_at,
      cameraBlockedBy: device.blockedByUser
        ? {
            id: device.blockedByUser.id,
            username: device.blockedByUser.username,
            name: `${device.blockedByUser.first_name || ''} ${device.blockedByUser.last_name || ''}`.trim(),
          }
        : null,
      lastSync: device.last_sync,
      employee: device.Employee
        ? {
            id: device.Employee.id,
            employeeId: device.Employee.employee_id,
            department: device.Employee.department,
            user: device.Employee.User
              ? {
                  id: device.Employee.User.id,
                  username: device.Employee.User.username,
                  firstName: device.Employee.User.first_name,
                  lastName: device.Employee.User.last_name,
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
