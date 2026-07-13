jest.mock('../../../src/models', () => ({
  Device: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const DeviceSyncService = require('../../../src/services/DeviceSyncService');
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
  device_info: null,
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

  describe('updateDeviceFromCheckIn', () => {
    const checkInData = {
      udid: 'UDID-001',
      serialNumber: 'SN-12345',
      deviceName: 'John iPhone',
      model: 'iPhone14,2',
      productType: 'iPhone',
      osVersion: '17.5.1',
      buildVersion: '21F90',
      pushToken: 'apns-token-xyz',
      pushMagic: 'push-magic-abc',
      enrollmentId: 'enr-abc-123',
    };

    it('creates a new device when one does not exist', async () => {
      db.Device.findOne.mockResolvedValue(null);
      db.Device.create.mockResolvedValue(mockDeviceInstance(checkInData));

      const result = await DeviceSyncService.updateDeviceFromCheckIn(checkInData);

      expect(db.Device.findOne).toHaveBeenCalledTimes(2);
      expect(db.Device.create).toHaveBeenCalledWith(
        expect.objectContaining({
          device_identifier: 'UDID-001',
          serial_number: 'SN-12345',
          device_name: 'John iPhone',
          device_os: 'ios',
          status: 'active',
          device_info: {
            nanomdm_enrollment_id: 'enr-abc-123',
            push_magic: 'push-magic-abc',
            model: 'iPhone14,2',
            product_type: 'iPhone',
            os_version: '17.5.1',
            build_version: '21F90',
          },
        }),
      );
      expect(result).toBeTruthy();
    });

    it('updates an existing device by UDID', async () => {
      const existingDevice = mockDeviceInstance();
      db.Device.findOne.mockResolvedValue(existingDevice);

      const result = await DeviceSyncService.updateDeviceFromCheckIn(checkInData);

      expect(mockDeviceUpdate).toHaveBeenCalled();
      const updateCall = mockDeviceUpdate.mock.calls[0][0];
      expect(updateCall.device_name).toBe('John iPhone');
      expect(updateCall.serial_number).toBe('SN-12345');
      expect(updateCall.push_notification_token).toBe('apns-token-xyz');
      expect(updateCall.device_info).toEqual({
        nanomdm_enrollment_id: 'enr-abc-123',
        push_magic: 'push-magic-abc',
        model: 'iPhone14,2',
        product_type: 'iPhone',
        os_version: '17.5.1',
        build_version: '21F90',
      });
      expect(result).toBe(existingDevice);
    });

    it('looks up by serial number when UDID is not provided', async () => {
      const dataWithoutUdid = { ...checkInData, udid: null };
      db.Device.findOne.mockResolvedValue(null);

      await DeviceSyncService.updateDeviceFromCheckIn(dataWithoutUdid);

      expect(db.Device.findOne).toHaveBeenCalledWith({
        where: { device_identifier: 'SN-12345' },
        paranoid: false,
      });
    });

    it('returns null when both udid and serialNumber are missing', async () => {
      const result = await DeviceSyncService.updateDeviceFromCheckIn({});
      expect(result).toBeNull();
    });

    it('preserves existing device_info fields when merging', async () => {
      const existingDevice = mockDeviceInstance({
        device_info: {
          existing_field: 'keep-me',
          push_magic: 'old-magic',
        },
      });
      db.Device.findOne.mockResolvedValue(existingDevice);

      await DeviceSyncService.updateDeviceFromCheckIn(checkInData);

      const updateCall = mockDeviceUpdate.mock.calls[0][0];
      expect(updateCall.device_info.existing_field).toBe('keep-me');
      expect(updateCall.device_info.push_magic).toBe('push-magic-abc');
      expect(updateCall.device_info.nanomdm_enrollment_id).toBe('enr-abc-123');
    });

    it('updates last_sync on every check-in', async () => {
      const existingDevice = mockDeviceInstance();
      db.Device.findOne.mockResolvedValue(existingDevice);

      await DeviceSyncService.updateDeviceFromCheckIn(checkInData);

      expect(mockDeviceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_sync: expect.any(Date),
        }),
      );
    });
  });

  describe('_updateDevice', () => {
    it('updates allowed fields and merges device_info', async () => {
      const device = mockDeviceInstance({ device_info: { existing: 'data' } });
      const syncData = {
        device_name: 'Updated Name',
        serial_number: 'SN-NEW',
        device_os: 'ios',
        supervised: true,
        push_notification_token: 'new-token',
        notification_platform: 'apns',
        last_sync: new Date(),
        device_info: { new_field: 'value' },
      };

      await DeviceSyncService._updateDevice(device, syncData);

      expect(mockDeviceUpdate).toHaveBeenCalledWith({
        device_name: 'Updated Name',
        serial_number: 'SN-NEW',
        device_os: 'ios',
        supervised: true,
        push_notification_token: 'new-token',
        notification_platform: 'apns',
        last_sync: syncData.last_sync,
        device_info: { existing: 'data', new_field: 'value' },
      });
    });

    it('does not update when syncData has no updatable fields', async () => {
      const device = mockDeviceInstance();
      const syncData = { device_identifier: 'UDID-001' };

      await DeviceSyncService._updateDevice(device, syncData);

      expect(mockDeviceUpdate).not.toHaveBeenCalled();
    });
  });
});
