const logger = require('../../utils/logger');
const NanoMDMService = require('./NanoMDMService');
const NotFoundError = require('../../exceptions/NotFoundError');
const ExternalServiceError = require('../../exceptions/ExternalServiceError');

class DeviceCommandService {
  async queueCommand(udid, command, commandPayload = {}) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required');
    }
    if (!command) {
      throw new NotFoundError('Command name is required');
    }

    logger.info(`[MDM:DeviceCommand] Queueing ${command} for device ${udid}`);

    const payload = {
      command,
      device_udids: [udid],
      ...commandPayload,
    };

    const result = await NanoMDMService.enqueueCommand(udid, payload);

    await NanoMDMService.sendPush(udid).catch((err) => {
      logger.warn(`[MDM:DeviceCommand] APNs push failed for ${udid} (non-fatal): ${err.message}`);
    });

    logger.info(`[MDM:DeviceCommand] Command ${command} queued for device ${udid} | uuid=${result.command_uuid}`);

    return {
      command_uuid: result.command_uuid || null,
      udid,
      command,
      status: 'queued',
    };
  }

  async getDeviceCommands(udid, filterStatus = null) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required');
    }

    logger.info(`[MDM:DeviceCommand] Getting commands for device ${udid}`);

    const filters = { udid };
    if (filterStatus) {
      filters.status = filterStatus;
    }

    const result = await NanoMDMService.listCommands(filters);

    const commands = Array.isArray(result) ? result : (result.commands || []);
    const formatted = commands.map((cmd) => this._formatCommand(cmd));

    return {
      udid,
      commands: formatted,
      total: formatted.length,
    };
  }

  async getCommandStatus(commandUuid) {
    if (!commandUuid) {
      throw new NotFoundError('Command UUID is required');
    }

    logger.info(`[MDM:DeviceCommand] Getting status for command ${commandUuid}`);

    const result = await NanoMDMService.getCommand(commandUuid);

    return this._formatCommand(result);
  }

  async retryCommand(udid, commandName, originalPayload = {}) {
    if (!udid) {
      throw new NotFoundError('Device UDID is required');
    }
    if (!commandName) {
      throw new NotFoundError('Command name is required to retry');
    }

    logger.info(`[MDM:DeviceCommand] Retrying command ${commandName} for device ${udid}`);

    return this.queueCommand(udid, commandName, originalPayload);
  }

  _formatCommand(cmd) {
    return {
      command_uuid: cmd.command_uuid || cmd.uuid || null,
      command: cmd.command || cmd.command_type || null,
      status: cmd.status || 'unknown',
      queued_at: cmd.queued_at || cmd.created_at || null,
      acknowledged_at: cmd.acknowledged_at || null,
      error_message: cmd.error_message || cmd.error || null,
      request_payload: cmd.request_payload || null,
      response_data: cmd.response_data || null,
    };
  }
}

module.exports = new DeviceCommandService();
