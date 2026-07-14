const logger = require('../utils/logger');
const ManualEnrollmentService = require('../services/ManualEnrollmentService');

class EnrollController {
  async getProfile(req, res, next) {
    try {
      const serialNumber = req.query.serial || null;

      logger.info(`[EnrollController] Profile requested | serial=${serialNumber || 'none'} | ip=${req.ip}`);

      const result = await ManualEnrollmentService.generateProfile(serialNumber);

      logger.info(`[EnrollController] Profile downloaded | serial=${result.serialNumber} | size=${result.mobileconfig.length}`);

      res.set('Content-Type', result.mimeType);
      res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.set('Content-Length', Buffer.byteLength(result.mobileconfig, 'utf8'));
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.send(result.mobileconfig);
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req, res, next) {
    try {
      const { serial } = req.params;

      logger.info(`[EnrollController] Status requested for serial ${serial}`);

      const status = await ManualEnrollmentService.getEnrollmentStatus(serial);

      logger.info(`[EnrollController] Status result for ${serial}: ${status.status}`);

      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EnrollController();
