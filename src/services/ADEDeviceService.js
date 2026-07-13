const db = require('../models');
const logger = require('../utils/logger');
const environment = require('../../config/environment');
const ADEEnrollmentService = require('./ADEEnrollmentService');

class ADEDeviceService {
  async lookupDevice({ serialNumber, model, udid }) {
    logger.info(`[ADEDevice] Looking up device by serial: ${serialNumber}`);

    if (!serialNumber) {
      throw new Error('Serial number is required for device lookup');
    }

    let enrollment = await db.AdeEnrollment.findOne({
      where: { serial_number: serialNumber },
      include: [
        {
          model: db.EnrollmentProfile,
          required: false,
        },
      ],
    });

    if (!enrollment) {
      logger.info(
        `[ADEDevice] Device not found, creating new enrollment for serial: ${serialNumber}`,
      );

      const defaultProfile = await db.EnrollmentProfile.findOne({
        where: { is_default: true, is_active: true },
      });

      enrollment = await db.AdeEnrollment.create({
        serial_number: serialNumber,
        udid: udid || null,
        model: model || null,
        organization: environment.ade.organization,
        status: 'pending',
        profile_uuid: defaultProfile ? defaultProfile.profile_uuid : null,
      });

      logger.info(
        `[ADEDevice] Created new enrollment ${enrollment.id} for serial: ${serialNumber}`,
      );

      await ADEEnrollmentService.recordEvent(
        serialNumber,
        'ade_device_discovered',
        { model, udid, enrollmentId: enrollment.id },
        'success',
      );
    } else {
      const updates = {};
      if (udid && udid !== enrollment.udid) updates.udid = udid;
      if (model && model !== enrollment.model) updates.model = model;

      if (Object.keys(updates).length > 0) {
        await enrollment.update(updates);
        logger.info(`[ADEDevice] Updated enrollment ${enrollment.id} for serial: ${serialNumber}`);
      }
    }

    const localDevice = await db.Device.findOne({
      where: { serial_number: serialNumber },
      paranoid: false,
    });

    return this._formatDeviceResponse(enrollment, localDevice);
  }

  async getDeviceBySerial(serialNumber) {
    if (!serialNumber) {
      throw new Error('Serial number is required');
    }

    logger.info(`[ADEDevice] Fetching device by serial: ${serialNumber}`);

    const enrollment = await db.AdeEnrollment.findOne({
      where: { serial_number: serialNumber },
      include: [
        {
          model: db.EnrollmentProfile,
          required: false,
        },
      ],
    });

    if (!enrollment) {
      return null;
    }

    const localDevice = await db.Device.findOne({
      where: { serial_number: serialNumber },
      paranoid: false,
    });

    return this._formatDeviceResponse(enrollment, localDevice);
  }

  _formatDeviceResponse(enrollment, localDevice) {
    return {
      id: enrollment.id,
      serialNumber: enrollment.serial_number,
      udid: enrollment.udid,
      model: enrollment.model,
      organization: enrollment.organization,
      status: enrollment.status,
      profileUuid: enrollment.profile_uuid,
      profileName: enrollment.EnrollmentProfile ? enrollment.EnrollmentProfile.display_name : null,
      deviceId: localDevice ? localDevice.id : null,
      deviceIdentifier: localDevice ? localDevice.device_identifier : null,
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
      createdAt: enrollment.created_at,
      updatedAt: enrollment.updated_at,
    };
  }
}

module.exports = new ADEDeviceService();
