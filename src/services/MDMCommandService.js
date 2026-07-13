const db = require('../models');
const logger = require('../utils/logger');
const NotFoundError = require('../exceptions/NotFoundError');
const { Op } = require('sequelize');
const FirebaseService = require('../integrations/FirebaseService');

class MDMCommandService {
  async recordCommand({
    commandUuid,
    commandType,
    deviceIdentifier = null,
    requestPayload = null,
    responseData = null,
    status = 'sent',
    errorMessage = null,
    retryCount = 0,
    maxRetries = 3,
  }) {
    if (!commandUuid) {
      throw new Error('commandUuid is required to record an MDM command');
    }
    if (!commandType) {
      throw new Error('commandType is required to record an MDM command');
    }

    let deviceId = null;
    if (deviceIdentifier) {
      const device = await db.Device.findOne({
        where: { device_identifier: deviceIdentifier },
        paranoid: false,
      });
      if (device) {
        deviceId = device.id;
      }
    }

    const timestamps = {};
    if (status === 'sent') timestamps.sent_at = new Date();
    if (status === 'queued') timestamps.queued_at = new Date();

    const record = await db.MDMCommand.create({
      command_uuid: commandUuid,
      device_id: deviceId,
      device_identifier: deviceIdentifier,
      command_type: commandType,
      status,
      request_payload: requestPayload,
      response_data: responseData,
      error_message: errorMessage,
      retry_count: retryCount,
      max_retries: maxRetries,
      ...timestamps,
    });

    logger.info(
      `[MDMCommand] Recorded command ${commandUuid} | type=${commandType} | status=${status} | device=${deviceIdentifier || 'N/A'}`,
    );

    return this._formatCommand(record);
  }

  async getCommand(id) {
    const record = await db.MDMCommand.findByPk(id);
    if (!record) {
      throw new NotFoundError('MDM command not found');
    }
    return this._formatCommand(record);
  }

  async getCommandByUuid(commandUuid) {
    const record = await db.MDMCommand.findOne({
      where: { command_uuid: commandUuid },
    });
    if (!record) {
      throw new NotFoundError(`MDM command ${commandUuid} not found`);
    }
    return this._formatCommand(record);
  }

  async getCommands(filters = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      commandType = null,
      deviceIdentifier = null,
    } = filters;

    const where = {};

    if (status) {
      where.status = status;
    }
    if (commandType) {
      where.command_type = commandType;
    }
    if (deviceIdentifier) {
      where.device_identifier = deviceIdentifier;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await db.MDMCommand.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows.map((r) => this._formatCommand(r)),
      total: count,
      page,
      limit,
    };
  }

  async updateCommandStatus(id, status, updates = {}) {
    const record = await db.MDMCommand.findByPk(id);
    if (!record) {
      throw new NotFoundError('MDM command not found');
    }

    const allowedStatuses = ['queued', 'sent', 'acknowledged', 'failed'];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Allowed: ${allowedStatuses.join(', ')}`);
    }

    const updateData = {
      status,
      ...updates,
    };

    if (status === 'acknowledged') {
      updateData.acknowledged_at = new Date();
    }
    if (status === 'failed') {
      updateData.failed_at = new Date();
    }
    if (status === 'sent') {
      updateData.sent_at = new Date();
    }

    await record.update(updateData);

    logger.info(`[MDMCommand] Updated command ${record.command_uuid} | status=${status}`);

    this._sendCommandNotification(record, status);

    return this._formatCommand(record);
  }

  async getPendingCommands() {
    const records = await db.MDMCommand.findAll({
      where: {
        status: {
          [Op.notIn]: ['acknowledged', 'failed'],
        },
      },
      order: [['created_at', 'ASC']],
    });

    return records.map((r) => this._formatCommand(r));
  }

  _formatCommand(record) {
    return {
      id: record.id,
      commandUuid: record.command_uuid,
      deviceId: record.device_id,
      deviceIdentifier: record.device_identifier,
      commandType: record.command_type,
      status: record.status,
      requestPayload: record.request_payload,
      responseData: record.response_data,
      errorMessage: record.error_message,
      retryCount: record.retry_count,
      maxRetries: record.max_retries,
      queuedAt: record.queued_at,
      sentAt: record.sent_at,
      acknowledgedAt: record.acknowledged_at,
      failedAt: record.failed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  async _sendCommandNotification(record, newStatus) {
    if (!record.device_id) return;

    try {
      const device = await db.Device.findByPk(record.device_id, {
        attributes: ['id', 'push_notification_token', 'device_os'],
      });
      if (!device) return;

      if (newStatus === 'acknowledged') {
        await FirebaseService.sendCommandSuccessNotification(device, record.command_type);
      } else if (newStatus === 'failed') {
        await FirebaseService.sendCommandFailureNotification(
          device,
          record.command_type,
          record.error_message || 'Unknown error',
        );
      }
    } catch (notifError) {
      logger.warn(
        `[MDMCommand] FCM notification failed (non-fatal) for command ${record.command_uuid}: ${notifError.message}`,
      );
    }
  }
}

module.exports = new MDMCommandService();
