const DashboardService = require('../services/DashboardService');
const logger = require('../utils/logger');
const { formatResponse } = require('../utils/helpers');
const { paginate } = require('../utils/helpers');

/**
 * Dashboard Controller
 * Handles all dashboard-related requests for admin panel
 */
class DashboardController {
  /**
   * Get dashboard statistics
   * GET /api/v1/admin/dashboard/stats
   */
  async getDashboardStats(req, res, next) {
    try {
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : null,
        endDate: req.query.endDate ? new Date(req.query.endDate) : null,
        deviceStatus: req.query.deviceStatus,
      };

      const stats = await DashboardService.getDashboardStats(filters);

      res.status(200).json(
        formatResponse(stats, 'Dashboard statistics retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent activities
   * GET /api/v1/admin/dashboard/activities
   */
  async getRecentActivities(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit || 20);
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : null,
        endDate: req.query.endDate ? new Date(req.query.endDate) : null,
      };

      const result = await DashboardService.getRecentActivities(
        pagination.page,
        pagination.limit,
        filters,
      );

      res.status(200).json(
        formatResponse(result.data, 'Recent activities retrieved successfully', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get device management history (block/unblock actions)
   * GET /api/v1/admin/dashboard/device-history
   */
  async getDeviceManagementHistory(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit || 25);

      const result = await DashboardService.getDeviceManagementHistory(
        pagination.page,
        pagination.limit,
      );

      res.status(200).json(
        formatResponse(
          result.data,
          'Device management history retrieved successfully',
          {
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get OTP generation summary
   * GET /api/v1/admin/dashboard/otp-summary
   */
  async getOtpGenerationSummary(req, res, next) {
    try {
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : null,
        endDate: req.query.endDate ? new Date(req.query.endDate) : null,
      };

      const summary = await DashboardService.getOtpGenerationSummary(filters);

      res.status(200).json(
        formatResponse(summary, 'OTP generation summary retrieved successfully'),
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
