const db = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Dashboard Service
 * Handles all dashboard-related business logic
 */
class DashboardService {
  /**
   * Get dashboard statistics
   * Returns counts of devices in different states
   */
  async getDashboardStats(filters = {}) {
    try {
      const whereClause = {};

      if (filters.deviceStatus) {
        whereClause.status = filters.deviceStatus;
      }

      // Get all device statistics
      const [
        activeDevices,
        inactiveDevices,
        blockedDevices,
        lostDevices,
      ] = await Promise.all([
        db.Device.count({
          where: { ...whereClause, status: 'active', deleted_at: null },
        }),
        db.Device.count({
          where: { ...whereClause, status: 'inactive', deleted_at: null },
        }),
        db.Device.count({
          where: { ...whereClause, status: 'blocked', deleted_at: null },
        }),
        db.Device.count({
          where: { ...whereClause, status: 'lost', deleted_at: null },
        }),
      ]);

      // Get camera blocking statistics
      const cameraBlockedCount = await db.Device.count({
        where: {
          camera_blocked: true,
          deleted_at: null,
        },
      });

      const cameraUnblockedCount = activeDevices - cameraBlockedCount;

      // Get total devices
      const totalDevices = await db.Device.count({
        where: { deleted_at: null },
      });

      // Get active employees
      const activeEmployees = await db.Employee.count({
        where: { deleted_at: null, status: 'active' },
      });

      return {
        devices: {
          active: activeDevices,
          inactive: inactiveDevices,
          blocked: blockedDevices,
          lost: lostDevices,
          total: totalDevices,
        },
        camera: {
          blocked: cameraBlockedCount,
          unblocked: cameraUnblockedCount,
        },
        employees: {
          active: activeEmployees,
        },
      };
    } catch (error) {
      logger.error(`Error getting dashboard stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent activities - punch records and device actions
   * Combines punch-in/out records from recent times
   */
  async getRecentActivities(page = 1, limit = 20, filters = {}) {
    try {
      const offset = (page - 1) * limit;

      // Get recent punch records (punch-in and punch-out)
      const { count, rows } = await db.PunchRecord.findAndCountAll({
        include: [
          {
            model: db.Employee,
            attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department'],
          },
        ],
        where: filters.startDate || filters.endDate ? {
          timestamp: {
            [Op.gte]: filters.startDate || new Date(0),
            [Op.lte]: filters.endDate || new Date(),
          },
        } : {},
        order: [['timestamp', 'DESC']],
        limit,
        offset,
        raw: false,
        subQuery: false,
      });

      // Format the punch records for response
      const activities = rows.map((record) => ({
        id: record.id,
        type: 'punch_activity',
        action: record.punch_type === 'punch_in' ? 'Punch In' : 'Punch Out',
        description: `Employee ${record.Employee?.first_name || ''} ${record.Employee?.last_name || ''} ${record.punch_type === 'punch_in' ? 'punched in' : 'punched out'}`,
        employee: {
          id: record.Employee?.id,
          employeeId: record.Employee?.employee_id,
          name: `${record.Employee?.first_name || ''} ${record.Employee?.last_name || ''}`.trim(),
          department: record.Employee?.department,
        },
        timestamp: record.timestamp,
        location: record.location,
      }));

      return {
        data: activities,
        total: count,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`Error getting recent activities: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get device blocking/unblocking history from audit logs
   */
  async getDeviceManagementHistory(page = 1, limit = 25, filters = {}) {
    try {
      const offset = (page - 1) * limit;

      const { count, rows } = await db.AuditLog.findAndCountAll({
        include: [
          {
            model: db.User,
            attributes: ['id', 'username', 'first_name', 'last_name', 'email'],
          },
        ],
        where: {
          entity_type: 'device',
          action: {
            [Op.in]: ['device_camera_blocked', 'device_camera_unblocked'],
          },
        },
        order: [['created_at', 'DESC']],
        limit,
        offset,
        raw: false,
        subQuery: false,
      });

      const history = rows.map((log) => ({
        id: log.id,
        action: log.action,
        description: log.action === 'device_camera_blocked' ? 'Camera Blocked' : 'Camera Unblocked',
        deviceId: log.entity_id,
        performedBy: log.User ? {
          id: log.User.id,
          name: `${log.User.first_name || ''} ${log.User.last_name || ''}`.trim(),
          email: log.User.email,
        } : null,
        changes: log.changes,
        timestamp: log.created_at,
        status: log.status,
      }));

      return {
        data: history,
        total: count,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`Error getting device management history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get OTP generation history summary
   */
  async getOtpGenerationSummary(filters = {}) {
    try {
      const where = {};

      if (filters.startDate || filters.endDate) {
        where.created_at = {
          [Op.gte]: filters.startDate || new Date(0),
          [Op.lte]: filters.endDate || new Date(),
        };
      }

      const [
        totalOtpsGenerated,
        otpsUsed,
        otpsExpired,
      ] = await Promise.all([
        db.OneTimePassword.count({ where }),
        db.OneTimePassword.count({
          where: { ...where, is_used: true },
        }),
        db.OneTimePassword.count({
          where: {
            ...where,
            expires_at: {
              [Op.lt]: new Date(),
            },
            is_used: false,
          },
        }),
      ]);

      return {
        totalGenerated: totalOtpsGenerated,
        used: otpsUsed,
        expired: otpsExpired,
        pending: totalOtpsGenerated - otpsUsed - otpsExpired,
      };
    } catch (error) {
      logger.error(`Error getting OTP generation summary: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new DashboardService();
