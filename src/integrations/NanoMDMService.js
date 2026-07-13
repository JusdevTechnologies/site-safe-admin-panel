const axios = require('axios');
const environment = require('../../config/environment');
const logger = require('../utils/logger');
const ExternalServiceError = require('../exceptions/ExternalServiceError');
const { createAuthStrategy } = require('./auth');
const MDMCommandService = require('../services/MDMCommandService');
const db = require('../models');
const { MDM_AUDIT_ACTIONS, MDM_ENTITY_TYPES } = require('../constants');

const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const BASE_DELAY_MS = 1000;

class NanoMDMService {
  constructor() {
    this._client = null;
    this._retryCount = 0;
    this._authStrategy = null;
  }

  _getAuthStrategy() {
    if (this._authStrategy) return this._authStrategy;

    const { authType, apiKey, bearerToken } = environment.nanomdm;

    const authConfig = {};
    if (authType === 'api_key') authConfig.apiKey = apiKey;
    if (authType === 'bearer_token') authConfig.bearerToken = bearerToken;

    this._authStrategy = createAuthStrategy(authType, authConfig);
    logger.info(`[NanoMDM] Using authentication strategy: ${this._authStrategy.getType()}`);
    return this._authStrategy;
  }

  _getClient() {
    if (this._client) return this._client;

    const { baseUrl, timeout } = environment.nanomdm;

    if (!baseUrl) {
      throw new Error('NanoMDM is not configured. Set NANOMDM_BASE_URL environment variable.');
    }

    const strategy = this._getAuthStrategy();

    this._client = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this._client.interceptors.request.use(
      (config) => {
        config._startTime = Date.now();
        config = strategy.apply(config);
        logger.info(
          `[NanoMDM] Request | ${config.method.toUpperCase()} ${config.baseURL}${config.url}`,
        );
        return config;
      },
      (error) => Promise.reject(error),
    );

    this._client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config._startTime;
        logger.info(
          `[NanoMDM] Response | ${response.status} ${response.config.method.toUpperCase()} ${response.config.url} | ${duration}ms`,
        );
        return response;
      },
      async (error) => {
        if (!error.config) return Promise.reject(this._mapError(error));

        const duration = Date.now() - (error.config._startTime || Date.now());
        const status = error.response ? error.response.status : 'NETWORK_ERROR';

        logger.error(
          `[NanoMDM] Response | ${status} ${error.config.method.toUpperCase()} ${error.config.url} | ${duration}ms | ${error.message}`,
        );

        if (this._isRetryable(error) && this._retryCount < MAX_RETRIES) {
          this._retryCount += 1;
          const delay = this._getRetryDelay(this._retryCount, error.response);
          logger.warn(
            `[NanoMDM] Retry ${this._retryCount}/${MAX_RETRIES} after ${delay}ms | ${error.config.method.toUpperCase()} ${error.config.url}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this._client(error.config);
        }

        this._retryCount = 0;
        return Promise.reject(this._mapError(error));
      },
    );

    logger.info('NanoMDM HTTP client initialised');
    return this._client;
  }

  _isRetryable(error) {
    if (error.code === 'ECONNABORTED') return true;
    if (!error.response) return true;
    return RETRYABLE_STATUSES.includes(error.response.status);
  }

  _getRetryDelay(attempt, response) {
    if (response && response.status === 429 && response.headers['retry-after']) {
      return parseInt(response.headers['retry-after'], 10) * 1000;
    }
    const jitter = Math.random() * 500;
    return Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitter, 15000);
  }

  _mapError(error) {
    if (error instanceof ExternalServiceError) return error;

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      let message = `NanoMDM responded with ${status}`;
      if (data && data.message) message = data.message;
      if (data && data.error)
        message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);

      return new ExternalServiceError(message, {
        status,
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        responseData: data,
      });
    }

    if (error.code === 'ECONNABORTED') {
      return new ExternalServiceError('NanoMDM request timed out', {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        timeout: error.config?.timeout,
      });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new ExternalServiceError(`Cannot reach NanoMDM server: ${error.message}`, {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        code: error.code,
      });
    }

    return new ExternalServiceError(`NanoMDM request failed: ${error.message}`, {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
    });
  }

  async _request(config) {
    const startTime = Date.now();
    const client = this._getClient();

    try {
      const response = await client.request(config);
      const duration = Date.now() - startTime;

      this._trackCommand(config, response.data).catch((err) => {
        logger.warn(`[NanoMDM] Command tracking failed (non-fatal): ${err.message}`);
      });

      this._auditOperation(config, response.data, duration, null).catch((err) => {
        logger.warn(`[NanoMDM] Audit logging failed (non-fatal): ${err.message}`);
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const mappedError = this._mapError(error);

      this._auditOperation(config, null, duration, mappedError).catch((err) => {
        logger.warn(`[NanoMDM] Audit logging failed (non-fatal): ${err.message}`);
      });

      throw mappedError;
    }
  }

  _resolveAuditMeta(config) {
    const method = (config.method || '').toUpperCase();
    const url = config.url || '';
    const data = config.data || {};

    if (method === 'GET' && url === '/v1/devices') {
      return {
        action: MDM_AUDIT_ACTIONS.GET_DEVICES,
        entityType: MDM_ENTITY_TYPES.DEVICE,
        entityId: null,
      };
    }
    if (method === 'GET' && url.startsWith('/v1/devices/')) {
      const udid = decodeURIComponent(url.replace('/v1/devices/', ''));
      return {
        action: MDM_AUDIT_ACTIONS.GET_DEVICE,
        entityType: MDM_ENTITY_TYPES.DEVICE,
        entityId: udid,
      };
    }
    if (method === 'GET' && url === '/v1/profiles') {
      return {
        action: MDM_AUDIT_ACTIONS.GET_PROFILES,
        entityType: MDM_ENTITY_TYPES.PROFILE,
        entityId: null,
      };
    }
    if (method === 'GET' && url.startsWith('/v1/profiles/')) {
      const identifier = decodeURIComponent(url.replace('/v1/profiles/', ''));
      return {
        action: MDM_AUDIT_ACTIONS.GET_PROFILE,
        entityType: MDM_ENTITY_TYPES.PROFILE,
        entityId: identifier,
      };
    }
    if (method === 'POST' && url === '/v1/profiles') {
      const identifier = data.PayloadIdentifier || null;
      return {
        action: MDM_AUDIT_ACTIONS.CREATE_PROFILE,
        entityType: MDM_ENTITY_TYPES.PROFILE,
        entityId: identifier,
      };
    }
    if (method === 'PUT' && url.startsWith('/v1/profiles/')) {
      const identifier = decodeURIComponent(url.replace('/v1/profiles/', ''));
      return {
        action: MDM_AUDIT_ACTIONS.UPDATE_PROFILE,
        entityType: MDM_ENTITY_TYPES.PROFILE,
        entityId: identifier,
      };
    }
    if (method === 'DELETE' && url.startsWith('/v1/profiles/')) {
      const identifier = decodeURIComponent(url.replace('/v1/profiles/', ''));
      return {
        action: MDM_AUDIT_ACTIONS.DELETE_PROFILE,
        entityType: MDM_ENTITY_TYPES.PROFILE,
        entityId: identifier,
      };
    }
    if (method === 'POST' && url === '/v1/commands') {
      const command = data.command || 'Unknown';
      const actionMap = {
        InstallProfile: MDM_AUDIT_ACTIONS.INSTALL_PROFILE,
        RemoveProfile: MDM_AUDIT_ACTIONS.REMOVE_PROFILE,
      };
      return {
        action: actionMap[command] || MDM_AUDIT_ACTIONS.SEND_COMMAND,
        entityType: MDM_ENTITY_TYPES.COMMAND,
        entityId: null,
      };
    }
    if (method === 'GET' && url.startsWith('/v1/commands/')) {
      const uuid = decodeURIComponent(url.replace('/v1/commands/', ''));
      return {
        action: MDM_AUDIT_ACTIONS.GET_COMMAND,
        entityType: MDM_ENTITY_TYPES.COMMAND,
        entityId: uuid,
      };
    }
    if (method === 'GET' && url === '/v1/commands') {
      return {
        action: MDM_AUDIT_ACTIONS.GET_COMMANDS,
        entityType: MDM_ENTITY_TYPES.COMMAND,
        entityId: null,
      };
    }

    return {
      action: `nanomdm_${method.toLowerCase()}_unknown`,
      entityType: 'MDM_UNKNOWN',
      entityId: null,
    };
  }

  async _auditOperation(config, responseData, duration, error) {
    const meta = this._resolveAuditMeta(config);
    const commandUuid = responseData && responseData.command_uuid;

    const entityId = commandUuid || meta.entityId;
    const status = error ? 'failed' : 'success';

    const changes = {
      duration,
      method: (config.method || '').toUpperCase(),
      url: config.url,
      ...(config.data && { requestPayload: config.data }),
      ...(responseData && { responseData }),
      ...(error && { failureReason: error.message }),
    };

    try {
      await db.AuditLog.create({
        user_id: null,
        action: meta.action,
        entity_type: meta.entityType,
        entity_id: entityId || 'unknown',
        changes,
        status,
      });
    } catch (err) {
      logger.error(`[NanoMDM] Failed to write audit log: ${err.message}`);
    }
  }

  async _trackCommand(config, responseData) {
    const method = (config.method || '').toUpperCase();
    const url = config.url || '';

    if (method !== 'POST' || !url.includes('/v1/commands')) {
      return;
    }
    if (!responseData || !responseData.command_uuid) {
      return;
    }

    const requestBody = config.data || {};
    const deviceUdids = requestBody.device_udids || [];

    await MDMCommandService.recordCommand({
      commandUuid: responseData.command_uuid,
      commandType: requestBody.command || 'Unknown',
      deviceIdentifier: deviceUdids[0] || null,
      requestPayload: requestBody,
      responseData,
      status: 'sent',
    });
  }

  async getDevices(params = {}) {
    return this._request({
      method: 'GET',
      url: '/v1/devices',
      params,
    });
  }

  async getDevice(udid) {
    if (!udid) {
      throw new ExternalServiceError('Device UDID is required');
    }
    return this._request({
      method: 'GET',
      url: `/v1/devices/${encodeURIComponent(udid)}`,
    });
  }

  async getProfiles(params = {}) {
    return this._request({
      method: 'GET',
      url: '/v1/profiles',
      params,
    });
  }

  async getProfile(identifier) {
    if (!identifier) {
      throw new ExternalServiceError('Profile identifier is required');
    }
    return this._request({
      method: 'GET',
      url: `/v1/profiles/${encodeURIComponent(identifier)}`,
    });
  }

  async createProfile(profileData) {
    if (!profileData || !profileData.PayloadIdentifier) {
      throw new ExternalServiceError('Profile must include a PayloadIdentifier');
    }
    if (!profileData.PayloadContent) {
      throw new ExternalServiceError('Profile must include PayloadContent');
    }

    return this._request({
      method: 'POST',
      url: '/v1/profiles',
      data: profileData,
    });
  }

  async updateProfile(identifier, profileData) {
    if (!identifier) {
      throw new ExternalServiceError('Profile identifier is required');
    }
    if (!profileData) {
      throw new ExternalServiceError('Profile update data is required');
    }

    return this._request({
      method: 'PUT',
      url: `/v1/profiles/${encodeURIComponent(identifier)}`,
      data: profileData,
    });
  }

  async deleteProfile(identifier) {
    if (!identifier) {
      throw new ExternalServiceError('Profile identifier is required');
    }
    return this._request({
      method: 'DELETE',
      url: `/v1/profiles/${encodeURIComponent(identifier)}`,
    });
  }

  async installProfile(udid, profilePayload) {
    if (!udid) {
      throw new ExternalServiceError('Device UDID is required');
    }
    if (!profilePayload) {
      throw new ExternalServiceError('Profile payload is required');
    }

    return this._request({
      method: 'POST',
      url: '/v1/commands',
      data: {
        command: 'InstallProfile',
        device_udids: [udid],
        profile: profilePayload,
      },
    });
  }

  async removeProfile(udid, profileIdentifier) {
    if (!udid) {
      throw new ExternalServiceError('Device UDID is required');
    }
    if (!profileIdentifier) {
      throw new ExternalServiceError('Profile identifier is required');
    }

    return this._request({
      method: 'POST',
      url: '/v1/commands',
      data: {
        command: 'RemoveProfile',
        device_udids: [udid],
        profile_identifier: profileIdentifier,
      },
    });
  }

  async sendCommand(udid, commandBody) {
    if (!udid) {
      throw new ExternalServiceError('Device UDID is required');
    }
    if (!commandBody || !commandBody.command) {
      throw new ExternalServiceError('Command body with a "command" field is required');
    }

    return this._request({
      method: 'POST',
      url: '/v1/commands',
      data: {
        ...commandBody,
        device_udids: commandBody.device_udids || [udid],
      },
    });
  }

  async getCommand(commandUuid) {
    if (!commandUuid) {
      throw new ExternalServiceError('Command UUID is required');
    }
    return this._request({
      method: 'GET',
      url: `/v1/commands/${encodeURIComponent(commandUuid)}`,
    });
  }

  async getCommands(params = {}) {
    return this._request({
      method: 'GET',
      url: '/v1/commands',
      params,
    });
  }
}

module.exports = new NanoMDMService();
