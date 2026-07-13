const ADECertificateService = require('../services/ADECertificateService');
const ADESyncService = require('../services/ADESyncService');
const { formatResponse, paginate } = require('../utils/helpers');

class ADECertificateController {
  async createCertificate(req, res, next) {
    try {
      const result = await ADECertificateService.createCertificate(req.body);
      res.status(201).json(formatResponse(result, 'Certificate created'));
    } catch (error) {
      next(error);
    }
  }

  async updateCertificate(req, res, next) {
    try {
      const { id } = req.params;
      const result = await ADECertificateService.updateCertificate(id, req.body);
      res.status(200).json(formatResponse(result, 'Certificate updated'));
    } catch (error) {
      next(error);
    }
  }

  async getCertificate(req, res, next) {
    try {
      const { id } = req.params;
      const result = await ADECertificateService.getCertificate(id);
      res.status(200).json(formatResponse(result, 'Certificate retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async getAllCertificates(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const filters = {
        page: pagination.page,
        limit: pagination.limit,
        certificateType: req.query.certificateType,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      };

      const result = await ADECertificateService.getAllCertificates(filters);
      res.status(200).json(
        formatResponse(result.data, 'Certificates retrieved', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteCertificate(req, res, next) {
    try {
      const { id } = req.params;
      const result = await ADECertificateService.deleteCertificate(id);
      res.status(200).json(formatResponse(result, 'Certificate deleted'));
    } catch (error) {
      next(error);
    }
  }

  async syncAbmAssignment(req, res, next) {
    try {
      const result = await ADESyncService.syncAbmDeviceAssignment(req.body);
      res.status(200).json(formatResponse(result, 'ABM device assignment synced'));
    } catch (error) {
      next(error);
    }
  }

  async getAssignments(req, res, next) {
    try {
      const pagination = paginate(req.query.page, req.query.limit);
      const filters = {
        page: pagination.page,
        limit: pagination.limit,
        syncStatus: req.query.syncStatus,
        serialNumber: req.query.serialNumber,
      };

      const result = await ADESyncService.getAssignments(filters);
      res.status(200).json(
        formatResponse(result.data, 'Assignments retrieved', {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getAssignmentBySerial(req, res, next) {
    try {
      const { serial } = req.params;
      const result = await ADESyncService.getAssignmentBySerial(serial);
      if (!result) {
        return res.status(200).json(formatResponse(null, 'Assignment not found'));
      }
      res.status(200).json(formatResponse(result, 'Assignment retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async correlateNanoMDMEvent(req, res, next) {
    try {
      const result = await ADESyncService.correlateNanoMDMEvent(req.body);
      res.status(200).json(formatResponse(result, 'NanoMDM event correlated'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ADECertificateController();
