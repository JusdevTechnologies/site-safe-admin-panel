const axios = require('axios');
const environment = require('../../../config/environment');
const logger = require('../../utils/logger');
const ExternalServiceError = require('../../exceptions/ExternalServiceError');

const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const BASE_DELAY_MS = 1000;

class NanoMDMService {
  constructor() {
    this._client = null;
    this._retryCount = 0;
    this._pgPool = null;
  }

  _getPgPool() {
    if (this._pgPool) return this._pgPool;
    const { dbDsn } = environment.nanomdm;
    if (!dbDsn) return null;
    const { Pool } = require('pg');
    this._pgPool = new Pool({ connectionString: dbDsn });
    return this._pgPool;
  }

  async _queryNanoMDMDevices() {
    const pool = this._getPgPool();
    if (!pool) return null;

    const { rows } = await pool.query(`
      SELECT
        d.id AS udid,
        d.serial_number,
        e.id AS enrollment_id,
        e.push_magic,
        e.token_hex AS push_token,
        e.topic,
        e.enabled,
        e.type,
        e.last_seen_at AS last_seen
      FROM devices d
      JOIN enrollments e ON e.device_id = d.id
      WHERE e.enabled = true
      ORDER BY e.last_seen_at DESC
    `);
    return rows;
  }

  async _queryNanoMDMDevice(udid) {
    const pool = this._getPgPool();
    if (!pool) return null;

    const { rows } = await pool.query(
      `
      SELECT
        d.id AS udid,
        d.serial_number,
        e.id AS enrollment_id,
        e.push_magic,
        e.token_hex AS push_token,
        e.topic,
        e.enabled,
        e.type,
        e.last_seen_at AS last_seen
      FROM devices d
      JOIN enrollments e ON e.device_id = d.id
      WHERE d.id = $1 AND e.enabled = true
    `,
      [udid],
    );
    return rows[0] || null;
  }

  _getClient() {
    if (this._client) return this._client;

    const { baseUrl, apiKey, bearerToken, authType, timeout } = environment.nanomdm;

    if (!baseUrl) {
      throw new Error('NanoMDM is not configured. Set NANOMDM_BASE_URL environment variable.');
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (authType === 'api_key' && apiKey) {
      headers['Authorization'] = `Basic ${Buffer.from(`nanomdm:${apiKey}`).toString('base64')}`;
    } else if (authType === 'bearer_token' && bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    this._client = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout,
      headers,
    });

    this._client.interceptors.request.use(
      (config) => {
        config._startTime = Date.now();
        logger.debug(`[MDM:NanoMDM] Request | ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error),
    );

    this._client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config._startTime;
        logger.info(
          `[MDM:NanoMDM] Response | ${response.status} ${response.config.method.toUpperCase()} ${response.config.url} | ${duration}ms`,
        );
        return response;
      },
      async (error) => {
        if (!error.config) return Promise.reject(this._mapError(error));

        const duration = Date.now() - (error.config._startTime || Date.now());
        const status = error.response ? error.response.status : 'NETWORK_ERROR';

        logger.error(
          `[MDM:NanoMDM] Error | ${status} ${error.config.method.toUpperCase()} ${error.config.url} | ${duration}ms | ${error.message}`,
        );

        if (this._isRetryable(error) && this._retryCount < MAX_RETRIES) {
          this._retryCount += 1;
          const delay = this._getRetryDelay(this._retryCount, error.response);
          logger.warn(
            `[MDM:NanoMDM] Retry ${this._retryCount}/${MAX_RETRIES} after ${delay}ms | ${error.config.method.toUpperCase()} ${error.config.url}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this._client(error.config);
        }

        this._retryCount = 0;
        return Promise.reject(this._mapError(error));
      },
    );

    logger.info('[MDM:NanoMDM] HTTP client initialised');
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
    const client = this._getClient();

    try {
      const response = await client.request(config);
      return response.data;
    } catch (error) {
      throw this._mapError(error);
    }
  }

  async getVersion() {
    logger.info('[MDM:NanoMDM] Getting NanoMDM version');
    return this._request({ method: 'GET', url: '/version' });
  }

  async getPushCertificate() {
    logger.info('[MDM:NanoMDM] Getting push certificate');
    return this._request({ method: 'GET', url: '/v1/pushcert' });
  }

  async uploadPushCertificate(certData) {
    if (!certData) {
      throw new ExternalServiceError('Push certificate data is required');
    }
    logger.info('[MDM:NanoMDM] Uploading push certificate');
    return this._request({ method: 'PUT', url: '/v1/pushcert', data: certData });
  }

  async listDevices() {
    logger.info('[MDM:NanoMDM] Listing all devices');

    const dbDevices = await this._queryNanoMDMDevices();
    if (dbDevices) {
      logger.info(`[MDM:NanoMDM] Found ${dbDevices.length} device(s) via DB query`);
      return dbDevices.map((d) => ({
        ...d,
        last_seen: d.last_seen ? d.last_seen.toISOString() : null,
      }));
    }

    return this._request({ method: 'GET', url: '/v1/devices' });
  }

  async getDevice(udid) {
    if (!udid) {
      throw new ExternalServiceError('Device UDID is required');
    }
    logger.info(`[MDM:NanoMDM] Getting device ${udid}`);

    const dbDevice = await this._queryNanoMDMDevice(udid);
    if (dbDevice) {
      logger.info(`[MDM:NanoMDM] Found device ${udid} via DB query`);
      return {
        ...dbDevice,
        last_seen: dbDevice.last_seen ? dbDevice.last_seen.toISOString() : null,
      };
    }

    return this._request({
      method: 'GET',
      url: `/v1/devices/${encodeURIComponent(udid)}`,
    });
  }

  async enqueueCommand(enrollmentId, command) {
    if (!enrollmentId) {
      throw new ExternalServiceError('Enrollment ID is required');
    }

    const payload = command.command_payload || '';
    if (!payload) {
      throw new ExternalServiceError('Command payload is required');
    }

    logger.info(
      `[MDM:NanoMDM] Queueing command | enrollment=${enrollmentId} | payloadSize=${payload.length}`,
    );
    const client = this._getClient();
    try {
      const response = await client.request({
        method: 'PUT',
        url: `/v1/enqueue/${encodeURIComponent(enrollmentId)}`,
        headers: { 'Content-Type': 'application/x-apple-aspen-mdm-command' },
        data: payload,
      });
      return response.data;
    } catch (error) {
      throw this._mapError(error);
    }
  }

  async sendPush(enrollmentId) {
    if (!enrollmentId) {
      throw new ExternalServiceError('Enrollment ID is required');
    }

    logger.info(`[MDM:NanoMDM] Sending APNs push | enrollment=${enrollmentId}`);
    return this._request({
      method: 'GET',
      url: `/v1/push/${encodeURIComponent(enrollmentId)}`,
    });
  }

  async listCommands(filters = {}) {
    const { udid, status, limit, offset } = filters;
    const params = {};
    if (udid) params.udid = udid;
    if (status) params.status = status;
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;

    logger.info('[MDM:NanoMDM] Listing commands');
    return this._request({
      method: 'GET',
      url: '/v1/commands',
      params,
    });
  }

  async getCommand(commandUuid) {
    if (!commandUuid) {
      throw new ExternalServiceError('Command UUID is required');
    }
    logger.info(`[MDM:NanoMDM] Getting command ${commandUuid}`);
    return this._request({
      method: 'GET',
      url: `/v1/commands/${encodeURIComponent(commandUuid)}`,
    });
  }

  async escrowKeyUnlock(escrowKey) {
    if (!escrowKey) {
      throw new ExternalServiceError('Escrow key is required');
    }
    logger.info('[MDM:NanoMDM] Escrow key unlock');
    return this._request({
      method: 'POST',
      url: '/v1/escrowkeyunlock',
      data: { escrow_key: escrowKey },
    });
  }

  async healthCheck() {
    try {
      await this.getVersion();
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = new NanoMDMService();
