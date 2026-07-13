jest.mock('../../../src/integrations/NanoMDMService', () => ({
  getDevices: jest.fn(),
  getDevice: jest.fn(),
}));

jest.mock('../../../src/models', () => ({
  Device: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
}));

const DeviceSyncService = require('../../../src/services/DeviceSyncService');
const mockNanoMDMService = require('../../../src/integrations/NanoMDMService');
const db = require('../../../src/models');

const mockDeviceUpdate = jest.fn();

const mockDeviceInstance = (overrides = {}) => ({
  id: 'device-uuid-1',
  employee_id: 'employee-uuid-1',
  device_identifier: 'UDID-001',
  device_os: 'ios',
  device_name: 'Test iPhone',
  serial_number: null,
  supervised: false,
  status: 'active',
  camera_blocked: false,
  camera_blocked_by: null,
  camera_blocked_at: null,
  last_sync: null,
  push_notification_token: null,
  notification_platform: null,
  deleted_at: null,
  update: mockDeviceUpdate,
  ...overrides,
});

describe('DeviceSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeviceUpdate.mockImplementation(function (updates) {
      Object.assign(this, updates);
      return Promise.resolve(this);
    });
  });

  describe('_mapNanoMDMDevice', () => {
    it('maps all fields from a NanoMDM device', () => {
      const nanoDevice = {
        udid: 'abc-123',
        serial_number: 'F1GH2J3K',
        device_name: 'John iPhone',
        platform: 'ios',
        last_seen: '2026-07-13T10:00:00.000Z',
        supervised: true,
        push_token: 'fcm-token-xyz',
      };

      const result = DeviceSyncService._mapNanoMDMDevice(nanoDevice);

      expect(result).toEqual({
        device_identifier: 'abc-123',
        serial_number: 'F1GH2J3K',
        device_name: 'John iPhone',
        device_os: 'ios',
        last_sync: new Date('2026-07-13T10:00:00.000Z'),
        supervised: true,
        push_notification_token: 'fcm-token-xyz',
      });
    });

    it('returns null for null input', () => {
      expect(DeviceSyncService._mapNanoMDMDevice(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(DeviceSyncService._mapNanoMDMDevice(undefined)).toBeNull();
    });

    it('returns null for device without udid', () => {
      expect(DeviceSyncService._mapNanoMDMDevice({ device_name: 'No UDID' })).toBeNull();
    });

    it('handles missing optional fields', () => {
      const result = DeviceSyncService._mapNanoMDMDevice({ udid: 'abc' });

      expect(result).toEqual({
        device_identifier: 'abc',
      });
      expect(result.serial_number).toBeUndefined();
      expect(result.device_name).toBeUndefined();
      expect(result.last_sync).toBeUndefined();
      expect(result.device_os).toBeUndefined();
      expect(result.supervised).toBeUndefined();
      expect(result.push_notification_token).toBeUndefined();
    });

    it('only accepts ios or android for platform', () => {
      const ios = DeviceSyncService._mapNanoMDMDevice({ udid: '1', platform: 'ios' });
      expect(ios.device_os).toBe('ios');

      const android = DeviceSyncService._mapNanoMDMDevice({ udid: '2', platform: 'android' });
      expect(android.device_os).toBe('android');

      const windows = DeviceSyncService._mapNanoMDMDevice({ udid: '3', platform: 'windows' });
      expect(windows.device_os).toBeUndefined();
    });

    it('coerces serial_number to string', () => {
      const result = DeviceSyncService._mapNanoMDMDevice({
        udid: 'abc',
        serial_number: 12345,
      });
      expect(result.serial_number).toBe('12345');
    });

    it('coerces push_token to string', () => {
      const result = DeviceSyncService._mapNanoMDMDevice({
        udid: 'abc',
        push_token: 98765,
      });
      expect(result.push_notification_token).toBe('98765');
    });
  });

  describe('_updateDevice', () => {
    it('updates sync-allowed fields only', async () => {
      const device = mockDeviceInstance();
      const syncData = {
        device_identifier: 'UDID-001',
        serial_number: 'SN-123',
        device_name: 'Updated Name',
        device_os: 'android',
        supervised: true,
        last_sync: new Date('2026-07-13T12:00:00Z'),
        push_notification_token: 'new-token',
      };

      await DeviceSyncService._updateDevice(device, syncData);

      expect(mockDeviceUpdate).toHaveBeenCalledWith({
        serial_number: 'SN-123',
        device_name: 'Updated Name',
        last_sync: new Date('2026-07-13T12:00:00Z'),
        push_notification_token: 'new-token',
        device_os: 'android',
        supervised: true,
      });
    });

    it('does not overwrite locally managed camera fields', async () => {
      const device = mockDeviceInstance({
        camera_blocked: true,
        camera_blocked_by: 'admin-uuid',
        camera_blocked_at: new Date(),
      });
      const syncData = DeviceSyncService._mapNanoMDMDevice({
        udid: 'UDID-001',
        device_name: 'Updated',
      });

      await DeviceSyncService._updateDevice(device, syncData);

      expect(device.camera_blocked).toBe(true);
      expect(device.camera_blocked_by).toBe('admin-uuid');
      expect(device.camera_blocked_at).toBeTruthy();
    });

    it('does not overwrite employee_id', async () => {
      const device = mockDeviceInstance({ employee_id: 'emp-001' });
      const syncData = DeviceSyncService._mapNanoMDMDevice({
        udid: 'UDID-001',
        device_name: 'Updated',
      });

      await DeviceSyncService._updateDevice(device, syncData);

      expect(device.employee_id).toBe('emp-001');
    });

    it('does not overwrite device status', async () => {
      const device = mockDeviceInstance({ status: 'blocked' });
      const syncData = DeviceSyncService._mapNanoMDMDevice({
        udid: 'UDID-001',
        device_name: 'Updated',
      });

      await DeviceSyncService._updateDevice(device, syncData);

      expect(device.status).toBe('blocked');
    });

    it('does not update when syncData has no syncable fields', async () => {
      const device = mockDeviceInstance();
      const syncData = { device_identifier: 'UDID-001' };

      await DeviceSyncService._updateDevice(device, syncData);

      expect(mockDeviceUpdate).not.toHaveBeenCalled();
    });
  });

  describe('syncDevice', () => {
    it('syncs a single device by UDID', async () => {
      const nanoDevice = {
        udid: 'UDID-001',
        device_name: 'Synced iPhone',
        serial_number: 'SN-999',
        platform: 'ios',
        last_seen: '2026-07-13T10:00:00Z',
        supervised: true,
      };

      mockNanoMDMService.getDevice.mockResolvedValue(nanoDevice);
      db.Device.findOne.mockResolvedValue(mockDeviceInstance());

      const result = await DeviceSyncService.syncDevice('UDID-001');

      expect(mockNanoMDMService.getDevice).toHaveBeenCalledWith('UDID-001');
      expect(db.Device.findOne).toHaveBeenCalledWith({
        where: { device_identifier: 'UDID-001' },
        paranoid: false,
      });
      expect(mockDeviceUpdate).toHaveBeenCalled();
      expect(result).toEqual({ synced: 1, skipped: 0, errors: 0 });
    });

    it('skips when no local device matches', async () => {
      mockNanoMDMService.getDevice.mockResolvedValue({ udid: 'UNKNOWN' });
      db.Device.findOne.mockResolvedValue(null);

      const result = await DeviceSyncService.syncDevice('UNKNOWN');

      expect(result).toEqual({ synced: 0, skipped: 1, errors: 0 });
    });

    it('throws when NanoMDM call fails', async () => {
      mockNanoMDMService.getDevice.mockRejectedValue(new Error('NanoMDM error'));

      await expect(DeviceSyncService.syncDevice('UDID-001')).rejects.toThrow('NanoMDM error');
    });
  });

  describe('fullSync', () => {
    it('syncs all devices from NanoMDM', async () => {
      const nanoDevices = {
        devices: [
          { udid: 'UDID-001', device_name: 'iPhone 1', platform: 'ios' },
          { udid: 'UDID-002', device_name: 'iPhone 2', platform: 'ios' },
        ],
      };

      mockNanoMDMService.getDevices.mockResolvedValue(nanoDevices);
      db.Device.findAll.mockResolvedValue([
        mockDeviceInstance({ device_identifier: 'UDID-001' }),
        mockDeviceInstance({ id: 'device-uuid-2', device_identifier: 'UDID-002' }),
      ]);

      const result = await DeviceSyncService.fullSync();

      expect(mockNanoMDMService.getDevices).toHaveBeenCalledWith({ limit: 1000 });
      expect(result).toEqual({ synced: 2, skipped: 0, errors: 0 });
    });

    it('returns zeros when NanoMDM returns empty list', async () => {
      mockNanoMDMService.getDevices.mockResolvedValue({ devices: [] });

      const result = await DeviceSyncService.fullSync();

      expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
      expect(db.Device.findAll).not.toHaveBeenCalled();
    });

    it('throws on NanoMDM API errors', async () => {
      mockNanoMDMService.getDevices.mockRejectedValue(new Error('API unavailable'));

      await expect(DeviceSyncService.fullSync()).rejects.toThrow('API unavailable');
    });

    it('skips NanoMDM devices that have no local match', async () => {
      mockNanoMDMService.getDevices.mockResolvedValue({
        devices: [
          { udid: 'UDID-001', device_name: 'Known' },
          { udid: 'UDID-999', device_name: 'Unknown' },
        ],
      });
      db.Device.findAll.mockResolvedValue([mockDeviceInstance({ device_identifier: 'UDID-001' })]);

      const result = await DeviceSyncService.fullSync();

      expect(result).toEqual({ synced: 1, skipped: 1, errors: 0 });
    });

    it('skips NanoMDM devices without UDID', async () => {
      mockNanoMDMService.getDevices.mockResolvedValue({
        devices: [{ udid: 'UDID-001', device_name: 'Good' }, { device_name: 'No UDID' }, null],
      });
      db.Device.findAll.mockResolvedValue([mockDeviceInstance({ device_identifier: 'UDID-001' })]);

      const result = await DeviceSyncService.fullSync();

      expect(db.Device.findAll).toHaveBeenCalledWith({
        where: { device_identifier: ['UDID-001'] },
        paranoid: false,
      });
      expect(result).toEqual({ synced: 1, skipped: 2, errors: 0 });
    });
  });

  describe('incrementalSync', () => {
    it('syncs devices modified since given date', async () => {
      const since = '2026-07-12T00:00:00.000Z';
      mockNanoMDMService.getDevices.mockResolvedValue({
        devices: [{ udid: 'UDID-001', device_name: 'Updated iPhone' }],
      });
      db.Device.findAll.mockResolvedValue([mockDeviceInstance()]);

      const result = await DeviceSyncService.incrementalSync(since);

      expect(mockNanoMDMService.getDevices).toHaveBeenCalledWith({
        limit: 1000,
        since,
      });
      expect(result).toEqual({ synced: 1, skipped: 0, errors: 0 });
    });

    it('uses default 24h window when no since provided', async () => {
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

      mockNanoMDMService.getDevices.mockResolvedValue({ devices: [] });
      db.Device.findAll.mockResolvedValue([]);

      await DeviceSyncService.incrementalSync();

      const calls = mockNanoMDMService.getDevices.mock.calls[0][0];
      expect(calls.since).toBeDefined();
      const sinceTime = new Date(calls.since).getTime();
      expect(sinceTime).toBeGreaterThanOrEqual(twentyFourHoursAgo - 1000);
      expect(sinceTime).toBeLessThanOrEqual(now);
    });

    it('returns zeros when no recently modified devices', async () => {
      mockNanoMDMService.getDevices.mockResolvedValue({ devices: [] });

      const result = await DeviceSyncService.incrementalSync('2026-07-12T00:00:00Z');

      expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
      expect(db.Device.findAll).not.toHaveBeenCalled();
    });
  });
});
