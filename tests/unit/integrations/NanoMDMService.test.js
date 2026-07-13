const axios = require('axios');
const nanoMDMService = require('../../../src/integrations/NanoMDMService');
const ExternalServiceError = require('../../../src/exceptions/ExternalServiceError');

jest.mock('axios');

jest.mock('../../../src/services/MDMCommandService', () => ({
  recordCommand: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../src/models', () => ({
  AuditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../src/integrations/auth', () => {
  const ApiKeyStrategy = require('../../../src/integrations/auth/ApiKeyStrategy');
  const BearerTokenStrategy = require('../../../src/integrations/auth/BearerTokenStrategy');
  return {
    createAuthStrategy: jest.fn((type, config) => {
      if (type === 'api_key') return new ApiKeyStrategy(config.apiKey);
      if (type === 'bearer_token') return new BearerTokenStrategy(config.bearerToken);
      throw new Error(`Unknown type: ${type}`);
    }),
  };
});

jest.mock('../../../config/environment', () => ({
  logging: {
    level: 'silent',
    format: 'json',
  },
  nanomdm: {
    baseUrl: 'https://nanomdm.example.com',
    authType: 'api_key',
    apiKey: 'test-api-key',
    bearerToken: '',
    timeout: 30000,
  },
}));

let requestInterceptorSuccess;
let mockAxiosInstance;

beforeEach(() => {
  requestInterceptorSuccess = null;

  mockAxiosInstance = {
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn((success) => {
          requestInterceptorSuccess = success;
        }),
      },
      response: { use: jest.fn() },
    },
    defaults: {},
  };
  axios.create.mockReturnValue(mockAxiosInstance);
});

describe('NanoMDMService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nanoMDMService._client = null;
    nanoMDMService._retryCount = 0;
    nanoMDMService._authStrategy = null;
    axios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('initialization', () => {
    it('creates an axios client with correct base config on first use', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { version: '1.0.0' } });

      await nanoMDMService.getVersion();

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://nanomdm.example.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      expect(nanoMDMService._client).toBe(mockAxiosInstance);
    });

    it('registers request and response interceptors', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { version: '1.0.0' } });

      await nanoMDMService.getVersion();

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('applies auth strategy via request interceptor', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { version: '1.0.0' } });

      await nanoMDMService.getVersion();

      expect(requestInterceptorSuccess).toBeDefined();
      const enrichedConfig = requestInterceptorSuccess({
        headers: { 'Content-Type': 'application/json' },
        method: 'get',
        url: '/version',
      });
      expect(enrichedConfig.headers['X-API-Key']).toBe('test-api-key');
    });

    it('reuses the existing client instance', async () => {
      nanoMDMService._client = mockAxiosInstance;
      mockAxiosInstance.request.mockResolvedValue({ data: { version: '1.0.0' } });

      await nanoMDMService.getVersion();

      expect(axios.create).not.toHaveBeenCalled();
    });
  });

  describe('getVersion', () => {
    it('fetches the NanoMDM server version', async () => {
      const expected = { version: '1.0.0', build: 'abc123' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getVersion();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/version',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('getPushCertificate', () => {
    it('fetches push certificate info', async () => {
      const expected = { subject: 'CN=...', expiry: '2027-01-01' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getPushCertificate();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/pushcert',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('uploadPushCertificate', () => {
    const certData = { certificate: 'base64...', password: 'secret' };

    it('uploads a push certificate', async () => {
      const expected = { status: 'ok' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.uploadPushCertificate(certData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/v1/pushcert',
        data: certData,
      });
      expect(result).toEqual(expected);
    });

    it('throws when certData is missing', async () => {
      await expect(nanoMDMService.uploadPushCertificate(null)).rejects.toThrow(
        'Push certificate data is required',
      );
    });
  });

  describe('enqueueCommand', () => {
    const enrollmentId = 'enr-abc123';
    const command = {
      command: 'DeviceLock',
      device_udids: ['udid-1'],
      pin: '1234',
    };

    it('enqueues a command for a device', async () => {
      const expected = { command_uuid: 'uuid-789' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.enqueueCommand(enrollmentId, command);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/v1/enqueue/enr-abc123',
        data: command,
      });
      expect(result).toEqual(expected);
    });

    it('encodes the enrollment ID in the URL', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { command_uuid: 'uuid-abc' } });

      await nanoMDMService.enqueueCommand('enr with spaces', command);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/v1/enqueue/enr%20with%20spaces',
        data: command,
      });
    });

    it('throws when enrollment ID is empty', async () => {
      await expect(nanoMDMService.enqueueCommand('', command)).rejects.toThrow(
        'Enrollment ID is required',
      );
    });

    it('throws when enrollment ID is undefined', async () => {
      await expect(nanoMDMService.enqueueCommand(undefined, command)).rejects.toThrow(
        'Enrollment ID is required',
      );
    });

    it('throws when command is missing', async () => {
      await expect(nanoMDMService.enqueueCommand(enrollmentId, null)).rejects.toThrow(
        'Command with a "command" field is required',
      );
    });

    it('throws when command field is missing', async () => {
      await expect(nanoMDMService.enqueueCommand(enrollmentId, {})).rejects.toThrow(
        'Command with a "command" field is required',
      );
    });
  });

  describe('sendPush', () => {
    it('sends an APNs push for a device', async () => {
      const expected = { status: 'pushed' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.sendPush('enr-abc123');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/push/enr-abc123',
      });
      expect(result).toEqual(expected);
    });

    it('encodes the enrollment ID in the URL', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: {} });

      await nanoMDMService.sendPush('enr special');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/push/enr%20special',
      });
    });

    it('throws when enrollment ID is empty', async () => {
      await expect(nanoMDMService.sendPush('')).rejects.toThrow('Enrollment ID is required');
    });

    it('throws when enrollment ID is undefined', async () => {
      await expect(nanoMDMService.sendPush(undefined)).rejects.toThrow('Enrollment ID is required');
    });
  });

  describe('escrowKeyUnlock', () => {
    it('unlocks an escrow key', async () => {
      const expected = { status: 'unlocked' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.escrowKeyUnlock('escrow-key-123');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/escrowkeyunlock',
        data: { escrow_key: 'escrow-key-123' },
      });
      expect(result).toEqual(expected);
    });

    it('throws when escrow key is missing', async () => {
      await expect(nanoMDMService.escrowKeyUnlock(null)).rejects.toThrow('Escrow key is required');
    });
  });

  describe('error handling', () => {
    it('maps 4xx errors to ExternalServiceError', async () => {
      const errorResponse = {
        response: { status: 400, data: { message: 'Invalid enrollment ID' } },
        config: { method: 'put', url: '/v1/enqueue/bad' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.enqueueCommand('bad', { command: 'DeviceLock' })).rejects.toThrow(
        ExternalServiceError,
      );
      await expect(nanoMDMService.enqueueCommand('bad', { command: 'DeviceLock' })).rejects.toThrow(
        'Invalid enrollment ID',
      );
    });

    it('maps 404 errors to ExternalServiceError', async () => {
      const errorResponse = {
        response: { status: 404, data: { error: 'Enrollment not found' } },
        config: { method: 'put', url: '/v1/enqueue/nonexistent' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(
        nanoMDMService.enqueueCommand('nonexistent', { command: 'DeviceLock' }),
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        nanoMDMService.enqueueCommand('nonexistent', { command: 'DeviceLock' }),
      ).rejects.toThrow('Enrollment not found');
    });

    it('maps timeout errors to ExternalServiceError', async () => {
      const errorResponse = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
        config: { method: 'put', url: '/v1/enqueue/test', timeout: 30000 },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(
        nanoMDMService.enqueueCommand('test', { command: 'DeviceLock' }),
      ).rejects.toThrow(ExternalServiceError);
      await expect(
        nanoMDMService.enqueueCommand('test', { command: 'DeviceLock' }),
      ).rejects.toThrow('NanoMDM request timed out');
    });

    it('maps connection refused errors to ExternalServiceError', async () => {
      const errorResponse = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED',
        config: { method: 'get', url: '/version' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.getVersion()).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getVersion()).rejects.toThrow('Cannot reach NanoMDM server');
    });

    it('maps network errors without response to ExternalServiceError', async () => {
      const errorResponse = {
        message: 'Network Error',
        config: { method: 'get', url: '/version' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.getVersion()).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getVersion()).rejects.toThrow('NanoMDM request failed');
    });
  });

  describe('retry logic', () => {
    it('identifies retryable network errors', () => {
      expect(nanoMDMService._isRetryable({ code: 'ECONNABORTED' })).toBe(true);
      expect(nanoMDMService._isRetryable({ response: { status: 500 } })).toBe(true);
      expect(nanoMDMService._isRetryable({ response: { status: 429 } })).toBe(true);
      expect(nanoMDMService._isRetryable({ response: { status: 503 } })).toBe(true);
      expect(nanoMDMService._isRetryable({ response: { status: 504 } })).toBe(true);
    });

    it('does not retry 4xx client errors', () => {
      expect(nanoMDMService._isRetryable({ response: { status: 400 } })).toBe(false);
      expect(nanoMDMService._isRetryable({ response: { status: 401 } })).toBe(false);
      expect(nanoMDMService._isRetryable({ response: { status: 403 } })).toBe(false);
      expect(nanoMDMService._isRetryable({ response: { status: 404 } })).toBe(false);
    });

    it('computes exponential backoff delay for retries', () => {
      const delay1 = nanoMDMService._getRetryDelay(1, {});
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1500);

      const delay2 = nanoMDMService._getRetryDelay(2, {});
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2500);

      const delay3 = nanoMDMService._getRetryDelay(3, {});
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(4500);
    });

    it('respects retry-after header for 429 responses', () => {
      const delay = nanoMDMService._getRetryDelay(2, {
        status: 429,
        headers: { 'retry-after': '5' },
      });
      expect(delay).toBe(5000);
    });

    it('caps delay at 15 seconds', () => {
      const delay = nanoMDMService._getRetryDelay(10, {});
      expect(delay).toBeLessThanOrEqual(15000);
    });
  });

  describe('audit logging', () => {
    const db = require('../../../src/models');

    it('creates audit log on successful GET /version', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { version: '1.0.0' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.getVersion();

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_get_version',
          entity_type: 'MDM_SERVER',
          status: 'success',
          changes: expect.objectContaining({
            method: 'GET',
            url: '/version',
          }),
        }),
      );
    });

    it('creates audit log on successful PUT /v1/enqueue (install profile)', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { command_uuid: 'cmd-123' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.enqueueCommand('enr-abc', {
        command: 'InstallProfile',
        device_udids: ['UDID-001'],
        profile: { PayloadIdentifier: 'com.example', PayloadContent: {} },
      });

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_enqueue_command',
          entity_type: 'MDM_COMMAND',
          entity_id: 'cmd-123',
          status: 'success',
          changes: expect.objectContaining({
            requestPayload: expect.objectContaining({ command: 'InstallProfile' }),
          }),
        }),
      );
    });

    it('creates audit log on successful PUT /v1/enqueue (remove profile)', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { command_uuid: 'cmd-456' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.enqueueCommand('enr-abc', {
        command: 'RemoveProfile',
        device_udids: ['UDID-001'],
        profile_identifier: 'com.example.profile',
      });

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_enqueue_command',
          entity_id: 'cmd-456',
          status: 'success',
        }),
      );
    });

    it('creates audit log on successful GET /v1/pushcert', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { subject: 'CN=...' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.getPushCertificate();

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_get_pushcert',
          entity_type: 'MDM_CERTIFICATE',
          status: 'success',
        }),
      );
    });

    it('creates audit log on successful PUT /v1/pushcert', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { status: 'ok' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.uploadPushCertificate({ certificate: 'base64...', password: 'secret' });

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_upload_pushcert',
          entity_type: 'MDM_CERTIFICATE',
          status: 'success',
        }),
      );
    });

    it('creates audit log on successful GET /v1/push', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { status: 'pushed' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.sendPush('enr-abc');

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_send_push',
          entity_type: 'MDM_DEVICE',
          entity_id: 'enr-abc',
          status: 'success',
        }),
      );
    });

    it('creates audit log on successful POST /v1/escrowkeyunlock', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { status: 'unlocked' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.escrowKeyUnlock('escrow-key-123');

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_escrow_key_unlock',
          entity_type: 'MDM_COMMAND',
          status: 'success',
        }),
      );
    });

    it('creates audit log with failed status on error', async () => {
      const networkError = new Error('NanoMDM timeout');
      networkError.code = 'ECONNABORTED';
      mockAxiosInstance.request.mockRejectedValue(networkError);

      await expect(nanoMDMService.getVersion()).rejects.toThrow();

      const calls = db.AuditLog.create.mock.calls;
      const lastCall = calls[calls.length - 1][0];

      expect(lastCall.action).toBe('nanomdm_get_version');
      expect(lastCall.status).toBe('failed');
      expect(lastCall.changes.failureReason).toBeTruthy();
    });

    it('records duration in audit changes', async () => {
      mockAxiosInstance.request.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: { version: '1.0.0' }, config: { _startTime: Date.now() - 100 } });
          }, 50);
        });
      });

      await nanoMDMService.getVersion();

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            duration: expect.any(Number),
          }),
        }),
      );
    });
  });
});
