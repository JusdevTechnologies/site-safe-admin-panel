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
      mockAxiosInstance.request.mockResolvedValue({ data: { devices: [] } });

      await nanoMDMService.getDevices();

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
      mockAxiosInstance.request.mockResolvedValue({ data: { devices: [] } });

      await nanoMDMService.getDevices();

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('applies auth strategy via request interceptor', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { devices: [] } });

      await nanoMDMService.getDevices();

      expect(requestInterceptorSuccess).toBeDefined();
      const enrichedConfig = requestInterceptorSuccess({
        headers: { 'Content-Type': 'application/json' },
        method: 'get',
        url: '/v1/devices',
      });
      expect(enrichedConfig.headers['X-API-Key']).toBe('test-api-key');
    });

    it('reuses the existing client instance', async () => {
      nanoMDMService._client = mockAxiosInstance;
      mockAxiosInstance.request.mockResolvedValue({ data: { devices: [] } });

      await nanoMDMService.getDevices();

      expect(axios.create).not.toHaveBeenCalled();
    });
  });

  describe('getDevices', () => {
    it('fetches devices without params', async () => {
      const expected = { devices: [{ udid: 'abc' }] };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getDevices();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/devices',
        params: {},
      });
      expect(result).toEqual(expected);
    });

    it('fetches devices with query params', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { devices: [] } });

      await nanoMDMService.getDevices({ filter: 'ios', page: 1 });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/devices',
        params: { filter: 'ios', page: 1 },
      });
    });
  });

  describe('getDevice', () => {
    it('fetches a single device by UDID', async () => {
      const expected = { udid: 'abc123', status: 'active' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getDevice('abc123');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/devices/abc123',
      });
      expect(result).toEqual(expected);
    });

    it('encodes the UDID in the URL', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: {} });

      await nanoMDMService.getDevice('abc 123');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/devices/abc%20123',
      });
    });

    it('throws when UDID is empty', async () => {
      await expect(nanoMDMService.getDevice('')).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getDevice('')).rejects.toThrow('Device UDID is required');
    });

    it('throws when UDID is undefined', async () => {
      await expect(nanoMDMService.getDevice(undefined)).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getDevice(undefined)).rejects.toThrow('Device UDID is required');
    });
  });

  describe('getProfiles', () => {
    it('fetches profiles without params', async () => {
      const expected = { profiles: [{ identifier: 'com.example.profile' }] };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getProfiles();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/profiles',
        params: {},
      });
      expect(result).toEqual(expected);
    });

    it('fetches profiles with query params', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { profiles: [] } });

      await nanoMDMService.getProfiles({ limit: 50 });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/profiles',
        params: { limit: 50 },
      });
    });
  });

  describe('getProfile', () => {
    it('fetches a single profile by identifier', async () => {
      const expected = { PayloadIdentifier: 'com.example.profile', PayloadDisplayName: 'Test' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getProfile('com.example.profile');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/profiles/com.example.profile',
      });
      expect(result).toEqual(expected);
    });

    it('encodes the identifier in the URL', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: {} });

      await nanoMDMService.getProfile('test profile');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/profiles/test%20profile',
      });
    });

    it('throws when identifier is empty', async () => {
      await expect(nanoMDMService.getProfile('')).rejects.toThrow('Profile identifier is required');
    });

    it('throws when identifier is undefined', async () => {
      await expect(nanoMDMService.getProfile(undefined)).rejects.toThrow(
        'Profile identifier is required',
      );
    });
  });

  describe('createProfile', () => {
    const validProfile = {
      PayloadIdentifier: 'com.example.profile',
      PayloadContent: {
        /* profile content */
      },
      PayloadDisplayName: 'Test Profile',
    };

    it('creates a profile with POST', async () => {
      const expected = { profile_uuid: 'prof-123' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.createProfile(validProfile);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/profiles',
        data: validProfile,
      });
      expect(result).toEqual(expected);
    });

    it('throws when PayloadIdentifier is missing', async () => {
      await expect(nanoMDMService.createProfile({ PayloadContent: {} })).rejects.toThrow(
        'Profile must include a PayloadIdentifier',
      );
    });

    it('throws when PayloadContent is missing', async () => {
      await expect(
        nanoMDMService.createProfile({ PayloadIdentifier: 'com.example' }),
      ).rejects.toThrow('Profile must include PayloadContent');
    });

    it('throws when data is null', async () => {
      await expect(nanoMDMService.createProfile(null)).rejects.toThrow(
        'Profile must include a PayloadIdentifier',
      );
    });
  });

  describe('updateProfile', () => {
    const updateData = { PayloadDisplayName: 'Updated Profile' };

    it('updates a profile with PUT', async () => {
      const expected = { profile_uuid: 'prof-123', ...updateData };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.updateProfile('com.example.profile', updateData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/v1/profiles/com.example.profile',
        data: updateData,
      });
      expect(result).toEqual(expected);
    });

    it('throws when identifier is empty', async () => {
      await expect(nanoMDMService.updateProfile('', updateData)).rejects.toThrow(
        'Profile identifier is required',
      );
    });

    it('throws when identifier is undefined', async () => {
      await expect(nanoMDMService.updateProfile(undefined, updateData)).rejects.toThrow(
        'Profile identifier is required',
      );
    });

    it('throws when update data is missing', async () => {
      await expect(nanoMDMService.updateProfile('com.example.profile', null)).rejects.toThrow(
        'Profile update data is required',
      );
    });
  });

  describe('deleteProfile', () => {
    it('deletes a profile with DELETE', async () => {
      const expected = { deleted: true };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.deleteProfile('com.example.profile');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/v1/profiles/com.example.profile',
      });
      expect(result).toEqual(expected);
    });

    it('encodes the identifier in the URL', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: {} });

      await nanoMDMService.deleteProfile('test profile');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/v1/profiles/test%20profile',
      });
    });

    it('throws when identifier is empty', async () => {
      await expect(nanoMDMService.deleteProfile('')).rejects.toThrow(
        'Profile identifier is required',
      );
    });

    it('throws when identifier is undefined', async () => {
      await expect(nanoMDMService.deleteProfile(undefined)).rejects.toThrow(
        'Profile identifier is required',
      );
    });
  });

  describe('installProfile', () => {
    it('sends an install profile command', async () => {
      const payload = { PayloadContent: {}, PayloadIdentifier: 'com.example.profile' };
      const expected = { command_uuid: 'uuid-123' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.installProfile('udid-1', payload);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/commands',
        data: {
          command: 'InstallProfile',
          device_udids: ['udid-1'],
          profile: payload,
        },
      });
      expect(result).toEqual(expected);
    });

    it('throws when UDID is empty', async () => {
      await expect(nanoMDMService.installProfile('', {})).rejects.toThrow(
        'Device UDID is required',
      );
    });

    it('throws when profile payload is missing', async () => {
      await expect(nanoMDMService.installProfile('udid-1', null)).rejects.toThrow(
        'Profile payload is required',
      );
    });
  });

  describe('removeProfile', () => {
    it('sends a remove profile command', async () => {
      const expected = { command_uuid: 'uuid-456' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.removeProfile('udid-1', 'com.example.profile');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/commands',
        data: {
          command: 'RemoveProfile',
          device_udids: ['udid-1'],
          profile_identifier: 'com.example.profile',
        },
      });
      expect(result).toEqual(expected);
    });

    it('throws when UDID is empty', async () => {
      await expect(nanoMDMService.removeProfile('', 'com.example.profile')).rejects.toThrow(
        'Device UDID is required',
      );
    });

    it('throws when profile identifier is missing', async () => {
      await expect(nanoMDMService.removeProfile('udid-1', '')).rejects.toThrow(
        'Profile identifier is required',
      );
    });
  });

  describe('sendCommand', () => {
    it('sends a custom command with default device_udids', async () => {
      const commandBody = { command: 'DeviceLock', pin: '1234' };
      const expected = { command_uuid: 'uuid-789' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.sendCommand('udid-1', commandBody);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/commands',
        data: {
          command: 'DeviceLock',
          pin: '1234',
          device_udids: ['udid-1'],
        },
      });
      expect(result).toEqual(expected);
    });

    it('uses existing device_udids from commandBody when present', async () => {
      const commandBody = { command: 'DeviceLock', device_udids: ['udid-2', 'udid-3'] };
      mockAxiosInstance.request.mockResolvedValue({ data: {} });

      await nanoMDMService.sendCommand('udid-1', commandBody);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/commands',
        data: {
          command: 'DeviceLock',
          device_udids: ['udid-2', 'udid-3'],
        },
      });
    });

    it('throws when UDID is missing', async () => {
      await expect(nanoMDMService.sendCommand('', { command: 'DeviceLock' })).rejects.toThrow(
        'Device UDID is required',
      );
    });

    it('throws when command body is missing', async () => {
      await expect(nanoMDMService.sendCommand('udid-1', null)).rejects.toThrow(
        'Command body with a "command" field is required',
      );
    });

    it('throws when command field is missing', async () => {
      await expect(nanoMDMService.sendCommand('udid-1', {})).rejects.toThrow(
        'Command body with a "command" field is required',
      );
    });
  });

  describe('getCommand', () => {
    it('fetches a command by UUID', async () => {
      const expected = { command_uuid: 'uuid-123', status: 'Pending' };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getCommand('uuid-123');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/commands/uuid-123',
      });
      expect(result).toEqual(expected);
    });

    it('throws when command UUID is empty', async () => {
      await expect(nanoMDMService.getCommand('')).rejects.toThrow('Command UUID is required');
    });

    it('throws when command UUID is undefined', async () => {
      await expect(nanoMDMService.getCommand(undefined)).rejects.toThrow(
        'Command UUID is required',
      );
    });
  });

  describe('getCommands', () => {
    it('fetches commands without params', async () => {
      const expected = { commands: [] };
      mockAxiosInstance.request.mockResolvedValue({ data: expected });

      const result = await nanoMDMService.getCommands();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/commands',
        params: {},
      });
      expect(result).toEqual(expected);
    });

    it('fetches commands with query params', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { commands: [] } });

      await nanoMDMService.getCommands({ status: 'Pending', limit: 10 });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/commands',
        params: { status: 'Pending', limit: 10 },
      });
    });
  });

  describe('error handling', () => {
    it('maps 4xx errors to ExternalServiceError', async () => {
      const errorResponse = {
        response: { status: 400, data: { message: 'Invalid device UDID' } },
        config: { method: 'get', url: '/v1/devices/bad' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.getDevice('bad')).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getDevice('bad')).rejects.toThrow('Invalid device UDID');
    });

    it('maps 404 errors to ExternalServiceError', async () => {
      const errorResponse = {
        response: { status: 404, data: { error: 'Device not found' } },
        config: { method: 'get', url: '/v1/devices/nonexistent' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.getDevice('nonexistent')).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getDevice('nonexistent')).rejects.toThrow('Device not found');
    });

    it('maps timeout errors to ExternalServiceError', async () => {
      const errorResponse = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
        config: { method: 'post', url: '/v1/commands', timeout: 30000 },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.sendCommand('udid-1', { command: 'DeviceLock' })).rejects.toThrow(
        ExternalServiceError,
      );
      await expect(nanoMDMService.sendCommand('udid-1', { command: 'DeviceLock' })).rejects.toThrow(
        'NanoMDM request timed out',
      );
    });

    it('maps connection refused errors to ExternalServiceError', async () => {
      const errorResponse = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED',
        config: { method: 'get', url: '/v1/devices' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.getDevices()).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getDevices()).rejects.toThrow('Cannot reach NanoMDM server');
    });

    it('maps network errors without response to ExternalServiceError', async () => {
      const errorResponse = {
        message: 'Network Error',
        config: { method: 'get', url: '/v1/devices' },
      };
      mockAxiosInstance.request.mockRejectedValue(errorResponse);

      await expect(nanoMDMService.getDevices()).rejects.toThrow(ExternalServiceError);
      await expect(nanoMDMService.getDevices()).rejects.toThrow('NanoMDM request failed');
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

    it('creates audit log on successful GET /v1/devices', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [{ udid: 'UDID-001' }],
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.getDevices();

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_get_devices',
          entity_type: 'MDM_DEVICE',
          status: 'success',
          changes: expect.objectContaining({
            method: 'GET',
            url: '/v1/devices',
          }),
        }),
      );
    });

    it('creates audit log on successful POST /v1/commands (install profile)', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { command_uuid: 'cmd-123' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.installProfile('UDID-001', {
        PayloadIdentifier: 'com.example',
        PayloadContent: {},
      });

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_install_profile',
          entity_type: 'MDM_COMMAND',
          entity_id: 'cmd-123',
          status: 'success',
          changes: expect.objectContaining({
            requestPayload: expect.objectContaining({ command: 'InstallProfile' }),
          }),
        }),
      );
    });

    it('creates audit log on successful POST /v1/commands (remove profile)', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { command_uuid: 'cmd-456' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.removeProfile('UDID-001', 'com.example.profile');

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_remove_profile',
          entity_id: 'cmd-456',
          status: 'success',
        }),
      );
    });

    it('creates audit log on successful GET /v1/profiles', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { profiles: [] },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.getProfiles();

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_get_profiles',
          entity_type: 'MDM_PROFILE',
          status: 'success',
        }),
      );
    });

    it('creates audit log on successful POST /v1/profiles', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { profile_uuid: 'prof-123' },
        config: { _startTime: Date.now() },
      });

      await nanoMDMService.createProfile({
        PayloadIdentifier: 'com.example.camera',
        PayloadContent: { allowCamera: false },
      });

      expect(db.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'nanomdm_create_profile',
          entity_type: 'MDM_PROFILE',
          entity_id: 'com.example.camera',
          status: 'success',
        }),
      );
    });

    it('creates audit log with failed status on error', async () => {
      const networkError = new Error('NanoMDM timeout');
      networkError.code = 'ECONNABORTED';
      mockAxiosInstance.request.mockRejectedValue(networkError);

      await expect(nanoMDMService.getDevices()).rejects.toThrow();

      const calls = db.AuditLog.create.mock.calls;
      const lastCall = calls[calls.length - 1][0];

      expect(lastCall.action).toBe('nanomdm_get_devices');
      expect(lastCall.status).toBe('failed');
      expect(lastCall.changes.failureReason).toBeTruthy();
    });

    it('records duration in audit changes', async () => {
      mockAxiosInstance.request.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: [], config: { _startTime: Date.now() - 100 } });
          }, 50);
        });
      });

      await nanoMDMService.getDevices();

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
