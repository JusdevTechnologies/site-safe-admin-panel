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

    if (method === 'GET' && url === '/version') {
      return {
        action: MDM_AUDIT_ACTIONS.GET_VERSION,
        entityType: MDM_ENTITY_TYPES.SERVER,
        entityId: null,
      };
    }
    if (method === 'GET' && url === '/v1/pushcert') {
      return {
        action: MDM_AUDIT_ACTIONS.GET_PUSHCERT,
        entityType: MDM_ENTITY_TYPES.CERTIFICATE,
        entityId: null,
      };
    }
    if (method === 'PUT' && url === '/v1/pushcert') {
      return {
        action: MDM_AUDIT_ACTIONS.UPLOAD_PUSHCERT,
        entityType: MDM_ENTITY_TYPES.CERTIFICATE,
        entityId: null,
      };
    }
    if (method === 'PUT' && url.startsWith('/v1/enqueue/')) {
      const enrollmentId = decodeURIComponent(url.replace('/v1/enqueue/', ''));
      const commandType = data.command || 'Unknown';
      return {
        action: MDM_AUDIT_ACTIONS.ENQUEUE_COMMAND,
        entityType: MDM_ENTITY_TYPES.COMMAND,
        entityId: enrollmentId,
        metadata: { commandType },
      };
    }
    if (method === 'GET' && url.startsWith('/v1/push/')) {
      const enrollmentId = decodeURIComponent(url.replace('/v1/push/', ''));
      return {
        action: MDM_AUDIT_ACTIONS.SEND_PUSH,
        entityType: MDM_ENTITY_TYPES.DEVICE,
        entityId: enrollmentId,
      };
    }
    if (method === 'POST' && url === '/v1/escrowkeyunlock') {
      return {
        action: MDM_AUDIT_ACTIONS.ESCROW_KEY_UNLOCK,
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
      ...(meta.metadata && { ...meta.metadata }),
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

    const isEnqueue = method === 'PUT' && url.includes('/v1/enqueue/');
    if (!isEnqueue) {
      return;
    }
    if (!responseData || !responseData.command_uuid) {
      return;
    }

    const requestBody = config.data || {};
    const enrollmentId = decodeURIComponent(url.replace('/v1/enqueue/', ''));
    const deviceUdids = requestBody.device_udids || [];

    await MDMCommandService.recordCommand({
      commandUuid: responseData.command_uuid,
      commandType: requestBody.command || 'Unknown',
      deviceIdentifier: deviceUdids[0] || enrollmentId,
      requestPayload: requestBody,
      responseData,
      status: 'queued',
    });
  }

  async getVersion() {
    logger.info('Receiving NanoMDM version');
    return this._request({
      method: 'GET',
      url: '/version',
    });
  }

  async getPushCertificate() {
    logger.info('Receiving Push Certificate');
    return this._request({
      method: 'GET',
      url: '/v1/pushcert',
    });
  }

  async uploadPushCertificate(certData) {
    if (!certData) {
      throw new ExternalServiceError('Push certificate data is required');
    }

    logger.info('Uploading Push Certificate');
    return this._request({
      method: 'PUT',
      url: '/v1/pushcert',
      data: certData,
    });
  }

  async enqueueCommand(enrollmentId, command) {
    if (!enrollmentId) {
      throw new ExternalServiceError('Enrollment ID is required');
    }
    if (!command || !command.command) {
      throw new ExternalServiceError('Command with a "command" field is required');
    }

    logger.info(`Queueing Command | ${command.command} | enrollment=${enrollmentId}`);
    return this._request({
      method: 'PUT',
      url: `/v1/enqueue/${encodeURIComponent(enrollmentId)}`,
      data: command,
    });
  }

  async sendPush(enrollmentId) {
    if (!enrollmentId) {
      throw new ExternalServiceError('Enrollment ID is required');
    }

    logger.info(`Sending APNs Push | enrollment=${enrollmentId}`);
    return this._request({
      method: 'GET',
      url: `/v1/push/${encodeURIComponent(enrollmentId)}`,
    });
  }

  async escrowKeyUnlock(escrowKey) {
    if (!escrowKey) {
      throw new ExternalServiceError('Escrow key is required');
    }

    logger.info('Receiving Escrow Key Unlock');
    return this._request({
      method: 'POST',
      url: '/v1/escrowkeyunlock',
      data: { escrow_key: escrowKey },
    });
  }
}

module.exports = new NanoMDMService();
