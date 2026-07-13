const ADEEnrollmentService = require('../services/ADEEnrollmentService');
const { formatResponse, paginate } = require('../utils/helpers');

class ADEEnrollmentController {
  async startEnrollment(req, res, next) {
    try {
      const { serialNumber, profileUuid, udid, model } = req.body;
      const result = await ADEEnrollmentService.startEnrollment({
        serialNumber,
        profileUuid,
        udid,
        model,
      });
      res.status(200).json(formatResponse(result, 'Enrollment started'));
    } catch (error) {
      next(error);
    }
  }

  async updateEnrollmentStatus(req, res, next) {
    try {
      const { serialNumber, status, udid, model, metadata } = req.body;
      const result = await ADEEnrollmentService.updateEnrollmentStatus({
        serialNumber,
        status,
        udid,
        model,
        metadata,
      });
      res.status(200).json(formatResponse(result, 'Enrollment status updated'));
    } catch (error) {
      next(error);
    }
  }

  async getEnrollment(req, res, next) {
    try {
      const { id } = req.params;
      const result = await ADEEnrollmentService.getEnrollment(id);
      res.status(200).json(formatResponse(result, 'Enrollment retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async getEnrollmentBySerial(req, res, next) {
    try {
      const { serial } = req.params;
      const result = await ADEEnrollmentService.getEnrollmentBySerial(serial);
      res.status(200).json(formatResponse(result, 'Enrollment retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async getAllEnrollments(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const filters = {
        page: pagination.page,
        limit: pagination.limit,
        status: req.query.status,
        serialNumber: req.query.serialNumber,
      };

      const result = await ADEEnrollmentService.getAllEnrollments(filters);
      res.status(200).json(
        formatResponse(result.data, 'Enrollments retrieved', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async recordEvent(req, res, next) {
    try {
      const { serialNumber, action, metadata, status } = req.body;
      await ADEEnrollmentService.recordEvent(serialNumber, action, metadata, status);
      res.status(200).json(formatResponse(null, 'Event recorded'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ADEEnrollmentController();
