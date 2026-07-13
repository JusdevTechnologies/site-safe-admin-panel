const db = require('../models');
const logger = require('../utils/logger');
const environment = require('../../config/environment');
const NotFoundError = require('../exceptions/NotFoundError');
const ValidationError = require('../exceptions/ValidationError');
const {
  ADE_ENROLLMENT_STATUS,
  ADE_ENROLLMENT_TRANSITIONS,
  ADE_AUDIT_ACTIONS,
  ADE_ENTITY_TYPES,
  AUDIT_ACTION_TYPES,
} = require('../constants');

class ADEEnrollmentService {
  async startEnrollment({ serialNumber, profileUuid, udid, model }) {
    logger.info(`[ADEEnrollment] Starting enrollment for device: ${serialNumber}`);

    let enrollment = await db.AdeEnrollment.findOne({
      where: { serial_number: serialNumber },
    });

    if (!enrollment) {
      enrollment = await db.AdeEnrollment.create({
        serial_number: serialNumber,
        udid: udid || null,
        model: model || null,
        organization: environment.ade.organization,
        profile_uuid: profileUuid || null,
        status: ADE_ENROLLMENT_STATUS.ENROLLMENT_STARTED,
        enrolled_at: new Date(),
      });

      logger.info(`[ADEEnrollment] Created enrollment ${enrollment.id} for ${serialNumber}`);
    } else {
      await this._transition(enrollment, ADE_ENROLLMENT_STATUS.ENROLLMENT_STARTED);
      const updates = { enrolled_at: new Date() };
      if (udid) updates.udid = udid;
      if (model) updates.model = model;
      if (profileUuid) updates.profile_uuid = profileUuid;
      await enrollment.update(updates);
    }

    const localDevice = await db.Device.findOne({
      where: { serial_number: serialNumber },
      paranoid: false,
    });

    if (localDevice && !enrollment.device_id) {
      await enrollment.update({ device_id: localDevice.id });
    }

    await this.recordEvent(
      serialNumber,
      ADE_AUDIT_ACTIONS.ENROLLMENT_STARTED,
      { enrollmentId: enrollment.id, profileUuid },
      'success',
    );

    return this._formatEnrollment(enrollment);
  }

  async updateEnrollmentStatus({ serialNumber, status, udid, model, metadata }) {
    logger.info(`[ADEEnrollment] Updating status for ${serialNumber} to ${status}`);

    if (!serialNumber) {
      throw new NotFoundError('Serial number is required');
    }

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
      throw new NotFoundError(`No enrollment found for serial ${serialNumber}`);
    }

    await this._transition(enrollment, status);

    const updates = {};
    if (udid) updates.udid = udid;
    if (model) updates.model = model;
    if (metadata) updates.metadata = { ...(enrollment.metadata || {}), ...metadata };

    if (status === ADE_ENROLLMENT_STATUS.CHECKIN_RECEIVED) {
      const localDevice = await db.Device.findOne({
        where: { serial_number: serialNumber },
        paranoid: false,
      });

      if (localDevice && !enrollment.device_id) {
        updates.device_id = localDevice.id;
      }

      if (udid && localDevice && !localDevice.device_identifier) {
        await localDevice.update({ device_identifier: udid });
      }
    }

    if (status === ADE_ENROLLMENT_STATUS.COMPLETED) {
      updates.completed_at = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await enrollment.update(updates);
    }

    const auditAction = this._mapStatusToAuditAction(status);
    await this.recordEvent(
      serialNumber,
      auditAction,
      {
        enrollmentId: enrollment.id,
        previousStatus: enrollment._previousStatus,
        newStatus: status,
      },
      status === ADE_ENROLLMENT_STATUS.FAILED ? 'failed' : 'success',
    );

    return this._formatEnrollment(enrollment);
  }

  async getEnrollment(id) {
    const enrollment = await db.AdeEnrollment.findByPk(id, {
      include: [
        {
          model: db.EnrollmentProfile,
          required: false,
        },
      ],
    });

    if (!enrollment) {
      throw new NotFoundError(`Enrollment ${id} not found`);
    }

    return this._formatEnrollment(enrollment);
  }

  async getEnrollmentBySerial(serialNumber) {
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
      throw new NotFoundError(`No enrollment found for serial ${serialNumber}`);
    }

    return this._formatEnrollment(enrollment);
  }

  async getAllEnrollments(filters = {}) {
    const { page = 1, limit = 10, status, serialNumber } = filters;

    const where = {};
    if (status) where.status = status;
    if (serialNumber) where.serial_number = serialNumber;

    const offset = (page - 1) * limit;

    const { count, rows } = await db.AdeEnrollment.findAndCountAll({
      where,
      include: [
        {
          model: db.EnrollmentProfile,
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows.map((e) => this._formatEnrollment(e)),
      total: count,
      page,
      limit,
    };
  }

  async recordEvent(serialNumber, action, metadata = {}, status = 'success') {
    try {
      const enrollment = await db.AdeEnrollment.findOne({
        where: { serial_number: serialNumber },
      });

      await db.AuditLog.create({
        user_id: null,
        action,
        entity_type: ADE_ENTITY_TYPES.ENROLLMENT,
        entity_id: enrollment ? enrollment.id : serialNumber,
        changes: metadata,
        ip_address: null,
        user_agent: null,
        status,
      });

      logger.info(`[ADEEnrollment] Audit: ${action} for ${serialNumber} | status=${status}`);
    } catch (error) {
      logger.error(`[ADEEnrollment] Failed to record audit event: ${error.message}`);
    }
  }

  async _transition(enrollment, newStatus) {
    const currentStatus = enrollment.status;
    enrollment._previousStatus = currentStatus;

    if (currentStatus === newStatus) {
      return;
    }

    const allowedTransitions = ADE_ENROLLMENT_TRANSITIONS[currentStatus];

    if (!allowedTransitions) {
      throw new ValidationError(
        `Invalid enrollment status transition from ${currentStatus} to ${newStatus}: unknown current status`,
      );
    }

    if (!allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Invalid enrollment status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`,
      );
    }

    await enrollment.update({ status: newStatus });
    logger.info(
      `[ADEEnrollment] Transitioned ${enrollment.serial_number}: ${currentStatus} -> ${newStatus}`,
    );
  }

  _mapStatusToAuditAction(status) {
    const map = {
      [ADE_ENROLLMENT_STATUS.PENDING]: AUDIT_ACTION_TYPES.CREATE,
      [ADE_ENROLLMENT_STATUS.ASSIGNED]: ADE_AUDIT_ACTIONS.DEVICE_ASSIGNED,
      [ADE_ENROLLMENT_STATUS.ENROLLMENT_STARTED]: ADE_AUDIT_ACTIONS.ENROLLMENT_STARTED,
      [ADE_ENROLLMENT_STATUS.CHECKIN_RECEIVED]: ADE_AUDIT_ACTIONS.CHECKIN_RECEIVED,
      [ADE_ENROLLMENT_STATUS.MDM_CONNECTION]: ADE_AUDIT_ACTIONS.NANOMDM_SYNC,
      [ADE_ENROLLMENT_STATUS.COMPLETED]: ADE_AUDIT_ACTIONS.ENROLLMENT_COMPLETED,
      [ADE_ENROLLMENT_STATUS.FAILED]: ADE_AUDIT_ACTIONS.ENROLLMENT_FAILED,
    };
    return map[status] || ADE_AUDIT_ACTIONS.ENROLLMENT_STATUS_CHANGED;
  }

  _formatEnrollment(enrollment) {
    return {
      id: enrollment.id,
      deviceId: enrollment.device_id,
      serialNumber: enrollment.serial_number,
      udid: enrollment.udid,
      model: enrollment.model,
      profileUuid: enrollment.profile_uuid,
      profileName: enrollment.EnrollmentProfile ? enrollment.EnrollmentProfile.display_name : null,
      organization: enrollment.organization,
      status: enrollment.status,
      metadata: enrollment.metadata,
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
      createdAt: enrollment.created_at,
      updatedAt: enrollment.updated_at,
    };
  }
}

module.exports = new ADEEnrollmentService();
