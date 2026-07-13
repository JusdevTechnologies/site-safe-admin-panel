const db = require('../models');
const logger = require('../utils/logger');
const { SYNC_STATUS, ADE_AUDIT_ACTIONS, ADE_ENTITY_TYPES } = require('../constants');

class ADESyncService {
  async syncAbmDeviceAssignment(data) {
    logger.info(`[ADESync] Syncing ABM assignment for serial: ${data.serialNumber}`);

    const { serialNumber, deviceFamily, model, os, assignedAt, assignedServer, profileUuid, profileStatus, organization } = data;

    let assignment = await db.AdeDeviceAssignment.findOne({
      where: { serial_number: serialNumber },
    });

    if (assignment) {
      const updates = {};
      if (deviceFamily !== undefined) updates.device_family = deviceFamily;
      if (model !== undefined) updates.model = model;
      if (os !== undefined) updates.os = os;
      if (assignedAt !== undefined) updates.assigned_at = assignedAt;
      if (assignedServer !== undefined) updates.assigned_server = assignedServer;
      if (profileUuid !== undefined) updates.profile_uuid = profileUuid;
      if (profileStatus !== undefined) updates.profile_status = profileStatus;
      if (organization !== undefined) updates.organization = organization;
      updates.sync_status = SYNC_STATUS.SYNCED;
      updates.last_sync_at = new Date();
      updates.sync_message = 'Assignment synced successfully';

      await assignment.update(updates);
      logger.info(`[ADESync] Updated ABM assignment for ${serialNumber}`);
    } else {
      assignment = await db.AdeDeviceAssignment.create({
        serial_number: serialNumber,
        device_family: deviceFamily || null,
        model: model || null,
        os: os || null,
        assigned_at: assignedAt || null,
        assigned_server: assignedServer || null,
        profile_uuid: profileUuid || null,
        profile_status: profileStatus || null,
        organization: organization || null,
        sync_status: SYNC_STATUS.SYNCED,
        last_sync_at: new Date(),
        sync_message: 'Assignment created from ABM sync',
      });
      logger.info(`[ADESync] Created ABM assignment for ${serialNumber}`);
    }

    await this._recordSyncAudit(serialNumber, ADE_AUDIT_ACTIONS.ABM_SYNC, {
      assignmentId: assignment.id,
      syncStatus: SYNC_STATUS.SYNCED,
    }, 'success');

    return this._formatAssignment(assignment);
  }

  async getAssignments(filters = {}) {
    const { page = 1, limit = 10, syncStatus, serialNumber } = filters;
    const where = {};
    if (syncStatus) where.sync_status = syncStatus;
    if (serialNumber) where.serial_number = serialNumber;

    const offset = (page - 1) * limit;
    const { count, rows } = await db.AdeDeviceAssignment.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows.map((a) => this._formatAssignment(a)),
      total: count,
      page,
      limit,
    };
  }

  async getAssignmentBySerial(serialNumber) {
    const assignment = await db.AdeDeviceAssignment.findOne({
      where: { serial_number: serialNumber },
    });
    if (!assignment) return null;
    return this._formatAssignment(assignment);
  }

  async correlateNanoMDMEvent({ serialNumber, udid, eventType, eventData, timestamp }) {
    logger.info(`[ADESync] Correlating NanoMDM event: ${eventType} for ${udid || serialNumber}`);

    if (!serialNumber && !udid) {
      throw new Error('Either serialNumber or udid is required for event correlation');
    }

    let enrollment;
    if (serialNumber) {
      enrollment = await db.AdeEnrollment.findOne({ where: { serial_number: serialNumber } });
    }

    if (!enrollment && udid) {
      enrollment = await db.AdeEnrollment.findOne({ where: { udid } });
    }

    if (!enrollment) {
      logger.warn(`[ADESync] No enrollment found for NanoMDM event ${eventType} (udid=${udid}, serial=${serialNumber})`);
      return null;
    }

    const statusMapping = {
      Authenticate: 'authenticated',
      TokenUpdate: 'checkin_received',
      CheckOut: null,
      DeviceInformation: null,
      InstallProfile: null,
      DeviceConfigured: 'device_configured',
    };

    const targetStatus = statusMapping[eventType];

    if (targetStatus) {
      try {
        const ADEEnrollmentService = require('./ADEEnrollmentService');
        await ADEEnrollmentService.updateEnrollmentStatus({
          serialNumber: enrollment.serial_number,
          status: targetStatus,
          udid: udid || enrollment.udid,
          metadata: { correlatedEvent: eventType, eventData, timestamp },
        });
        logger.info(`[ADESync] Updated enrollment ${enrollment.id} to ${targetStatus} via NanoMDM event ${eventType}`);
      } catch (transError) {
        logger.warn(`[ADESync] Could not transition enrollment ${enrollment.id} to ${targetStatus}: ${transError.message}`);
      }
    }

    await this._recordSyncAudit(
      enrollment.serial_number,
      ADE_AUDIT_ACTIONS.NANOMDM_EVENT_CORRELATED,
      { eventType, eventData, timestamp, enrollmentId: enrollment.id },
      'success',
    );

    return { enrollmentId: enrollment.id, eventType, correlated: true };
  }

  async _recordSyncAudit(serialNumber, action, metadata, status) {
    try {
      const enrollment = await db.AdeEnrollment.findOne({
        where: { serial_number: serialNumber },
      });

      await db.AuditLog.create({
        user_id: null,
        action,
        entity_type: ADE_ENTITY_TYPES.ASSIGNMENT,
        entity_id: enrollment ? enrollment.id : serialNumber,
        changes: metadata,
        ip_address: null,
        user_agent: null,
        status,
      });
    } catch (error) {
      logger.error(`[ADESync] Failed to record audit: ${error.message}`);
    }
  }

  _formatAssignment(assignment) {
    return {
      id: assignment.id,
      serialNumber: assignment.serial_number,
      deviceFamily: assignment.device_family,
      model: assignment.model,
      os: assignment.os,
      assignedAt: assignment.assigned_at,
      assignedServer: assignment.assigned_server,
      profileUuid: assignment.profile_uuid,
      profileStatus: assignment.profile_status,
      organization: assignment.organization,
      syncStatus: assignment.sync_status,
      syncError: assignment.sync_error,
      syncMessage: assignment.sync_message,
      lastSyncAt: assignment.last_sync_at,
      createdAt: assignment.created_at,
      updatedAt: assignment.updated_at,
    };
  }
}

module.exports = new ADESyncService();
