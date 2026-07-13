jest.mock('../../../src/services/ProfileService', () => ({
  assignProfile: jest.fn(),
  removeProfile: jest.fn(),
}));

jest.mock('../../../src/services/DeviceService', () => ({
  blockDeviceCamera: jest.fn(),
  unblockDeviceCamera: jest.fn(),
}));

jest.mock('../../../src/models', () => ({
  Device: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  DevicePolicy: {
    findOne: jest.fn(),
  },
}));

const CameraRestrictionService = require('../../../src/services/CameraRestrictionService');
const ProfileService = require('../../../src/services/ProfileService');
const DeviceService = require('../../../src/services/DeviceService');
const db = require('../../../src/models');
const NotFoundError = require('../../../src/exceptions/NotFoundError');
const ConflictError = require('../../../src/exceptions/ConflictError');

describe('CameraRestrictionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultCameraRestrictionPayload', () => {
    it('returns a valid camera restriction payload', () => {
      const payload = CameraRestrictionService.getDefaultCameraRestrictionPayload();

      expect(payload.PayloadIdentifier).toBe('com.sitesafe.camera.restriction');
      expect(payload.PayloadType).toBe('Configuration');
      expect(payload.PayloadContent).toBeInstanceOf(Array);
      expect(payload.PayloadContent[0].PayloadContent.allowCamera).toBe(false);
    });
  });

  describe('blockCamera', () => {
    const deviceId = 'device-uuid-1';
    const userId = 'user-uuid-1';
    const reason = 'Policy violation';

    it('blocks camera: assigns profile to device, updates local record', async () => {
      ProfileService.assignProfile.mockResolvedValue({ command_uuid: 'cmd-123' });
      DeviceService.blockDeviceCamera.mockResolvedValue({ id: deviceId, cameraBlocked: true });
      db.Device.findByPk.mockResolvedValue({
        id: deviceId,
        device_identifier: 'UDID-001',
        camera_blocked: false,
      });

      const result = await CameraRestrictionService.blockCamera(deviceId, userId, reason);

      expect(db.Device.findByPk).toHaveBeenCalledWith(deviceId);
      expect(ProfileService.assignProfile).toHaveBeenCalledWith(
        'UDID-001',
        CameraRestrictionService.getDefaultCameraRestrictionPayload(),
      );
      expect(DeviceService.blockDeviceCamera).toHaveBeenCalledWith(deviceId, userId, reason);
      expect(result).toEqual({ id: deviceId, cameraBlocked: true });
    });

    it('throws NotFoundError when device does not exist', async () => {
      db.Device.findByPk.mockResolvedValue(null);

      await expect(CameraRestrictionService.blockCamera(deviceId, userId, reason)).rejects.toThrow(
        NotFoundError,
      );

      expect(ProfileService.assignProfile).not.toHaveBeenCalled();
      expect(DeviceService.blockDeviceCamera).not.toHaveBeenCalled();
    });

    it('throws ConflictError when camera is already blocked', async () => {
      db.Device.findByPk.mockResolvedValue({
        id: deviceId,
        device_identifier: 'UDID-001',
        camera_blocked: true,
      });

      await expect(CameraRestrictionService.blockCamera(deviceId, userId, reason)).rejects.toThrow(
        ConflictError,
      );

      expect(ProfileService.assignProfile).not.toHaveBeenCalled();
      expect(DeviceService.blockDeviceCamera).not.toHaveBeenCalled();
    });

    it('propagates errors from ProfileService.assignProfile', async () => {
      ProfileService.assignProfile.mockRejectedValue(new Error('NanoMDM unavailable'));
      db.Device.findByPk.mockResolvedValue({
        id: deviceId,
        device_identifier: 'UDID-001',
        camera_blocked: false,
      });

      await expect(CameraRestrictionService.blockCamera(deviceId, userId, reason)).rejects.toThrow(
        'NanoMDM unavailable',
      );

      expect(DeviceService.blockDeviceCamera).not.toHaveBeenCalled();
    });
  });

  describe('unblockCamera', () => {
    const deviceId = 'device-uuid-1';
    const userId = 'user-uuid-1';
    const reason = 'Investigation complete';

    it('unblocks camera: removes profile from device, updates local record', async () => {
      ProfileService.removeProfile.mockResolvedValue({ command_uuid: 'cmd-456' });
      DeviceService.unblockDeviceCamera.mockResolvedValue({ id: deviceId, cameraBlocked: false });
      db.Device.findByPk.mockResolvedValue({
        id: deviceId,
        device_identifier: 'UDID-001',
        camera_blocked: true,
      });

      const result = await CameraRestrictionService.unblockCamera(deviceId, userId, reason);

      expect(db.Device.findByPk).toHaveBeenCalledWith(deviceId);
      expect(ProfileService.removeProfile).toHaveBeenCalledWith(
        'UDID-001',
        'com.sitesafe.camera.restriction',
      );
      expect(DeviceService.unblockDeviceCamera).toHaveBeenCalledWith(deviceId, userId, reason);
      expect(result).toEqual({ id: deviceId, cameraBlocked: false });
    });

    it('throws NotFoundError when device does not exist', async () => {
      db.Device.findByPk.mockResolvedValue(null);

      await expect(
        CameraRestrictionService.unblockCamera(deviceId, userId, reason),
      ).rejects.toThrow(NotFoundError);

      expect(ProfileService.removeProfile).not.toHaveBeenCalled();
      expect(DeviceService.unblockDeviceCamera).not.toHaveBeenCalled();
    });

    it('throws ConflictError when camera is already unblocked', async () => {
      db.Device.findByPk.mockResolvedValue({
        id: deviceId,
        device_identifier: 'UDID-001',
        camera_blocked: false,
      });

      await expect(
        CameraRestrictionService.unblockCamera(deviceId, userId, reason),
      ).rejects.toThrow(ConflictError);

      expect(ProfileService.removeProfile).not.toHaveBeenCalled();
      expect(DeviceService.unblockDeviceCamera).not.toHaveBeenCalled();
    });

    it('propagates errors from ProfileService.removeProfile', async () => {
      ProfileService.removeProfile.mockRejectedValue(new Error('NanoMDM unavailable'));
      db.Device.findByPk.mockResolvedValue({
        id: deviceId,
        device_identifier: 'UDID-001',
        camera_blocked: true,
      });

      await expect(
        CameraRestrictionService.unblockCamera(deviceId, userId, reason),
      ).rejects.toThrow('NanoMDM unavailable');

      expect(DeviceService.unblockDeviceCamera).not.toHaveBeenCalled();
    });
  });

  describe('getCameraStatus', () => {
    const deviceIdentifier = 'UDID-001';

    it('returns camera status from local DB and DevicePolicy', async () => {
      db.Device.findOne.mockResolvedValue({
        id: 'device-uuid-1',
        device_identifier: 'UDID-001',
        camera_blocked: true,
        camera_blocked_at: new Date('2026-07-13'),
        camera_blocked_by: 'user-uuid-1',
      });
      db.DevicePolicy.findOne.mockResolvedValue({
        id: 'policy-uuid-1',
        policy_type: 'com.sitesafe.camera.restriction',
        is_active: true,
      });

      const result = await CameraRestrictionService.getCameraStatus(deviceIdentifier);

      expect(result.cameraBlocked).toBe(true);
      expect(result.nanoMDMStatus).toBe('restricted');
    });

    it('returns unrestricted when DevicePolicy not found', async () => {
      db.Device.findOne.mockResolvedValue({
        id: 'device-uuid-1',
        device_identifier: 'UDID-001',
        camera_blocked: false,
        camera_blocked_at: null,
        camera_blocked_by: null,
      });
      db.DevicePolicy.findOne.mockResolvedValue(null);

      const result = await CameraRestrictionService.getCameraStatus(deviceIdentifier);

      expect(result.cameraBlocked).toBe(false);
      expect(result.nanoMDMStatus).toBe('unrestricted');
    });

    it('returns nanoMDMStatus as null when DB query fails', async () => {
      db.Device.findOne.mockResolvedValue({
        id: 'device-uuid-1',
        device_identifier: 'UDID-001',
        camera_blocked: false,
        camera_blocked_at: null,
        camera_blocked_by: null,
      });
      db.DevicePolicy.findOne.mockRejectedValue(new Error('DB error'));

      const result = await CameraRestrictionService.getCameraStatus(deviceIdentifier);

      expect(result.cameraBlocked).toBe(false);
      expect(result.nanoMDMStatus).toBeNull();
    });

    it('throws NotFoundError when device not found', async () => {
      db.Device.findOne.mockResolvedValue(null);

      await expect(CameraRestrictionService.getCameraStatus(deviceIdentifier)).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
