jest.mock('../../../src/integrations/NanoMDMService', () => ({
  enqueueCommand: jest.fn(),
  sendPush: jest.fn(),
}));

jest.mock('../../../src/models', () => ({
  Device: {
    findOne: jest.fn(),
  },
  DevicePolicy: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  },
}));

const ProfileService = require('../../../src/services/ProfileService');
const NanoMDMService = require('../../../src/integrations/NanoMDMService');
const db = require('../../../src/models');
const NotFoundError = require('../../../src/exceptions/NotFoundError');
const ConflictError = require('../../../src/exceptions/ConflictError');

const mockPolicyUpdate = jest.fn();

const validProfileData = {
  PayloadIdentifier: 'com.example.camera.restriction',
  PayloadContent: { some: 'content' },
  PayloadDisplayName: 'Camera Restriction Profile',
  PayloadOrganization: 'SiteSafe',
  PayloadDescription: 'Restricts camera access',
};

const mockDeviceWithEnrollment = {
  id: 'device-uuid-1',
  device_identifier: 'UDID-001',
  device_name: 'Test iPhone',
  serial_number: 'SN-123',
  device_info: {
    nanomdm_enrollment_id: 'enr-abc-123',
  },
};

describe('ProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile', () => {
    it('acknowledges profile creation locally', async () => {
      const result = await ProfileService.createProfile(validProfileData);

      expect(result).toEqual({
        identifier: 'com.example.camera.restriction',
        organization: 'SiteSafe',
        description: 'Restricts camera access',
        displayName: 'Camera Restriction Profile',
      });
    });
  });

  describe('updateProfile', () => {
    const updateData = { PayloadDisplayName: 'Updated' };

    it('acknowledges profile update locally', async () => {
      const result = await ProfileService.updateProfile('com.example.profile', updateData);

      expect(result.identifier).toBe('com.example.profile');
    });

    it('throws when identifier is missing', async () => {
      await expect(ProfileService.updateProfile('', updateData)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteProfile', () => {
    it('acknowledges profile deletion locally', async () => {
      const result = await ProfileService.deleteProfile('com.example.profile');

      expect(result).toEqual({ deleted: true, identifier: 'com.example.profile' });
    });

    it('throws when identifier is missing', async () => {
      await expect(ProfileService.deleteProfile('')).rejects.toThrow(NotFoundError);
    });
  });

  describe('assignProfile', () => {
    const udid = 'UDID-001';
    const profilePayload = {
      PayloadIdentifier: 'com.example.camera.restriction',
      PayloadContent: {},
    };

    it('enqueues InstallProfile via NanoMDM and creates DevicePolicy record', async () => {
      NanoMDMService.enqueueCommand.mockResolvedValue({ command_uuid: 'cmd-123' });
      NanoMDMService.sendPush.mockResolvedValue({ status: 'pushed' });
      db.Device.findOne.mockResolvedValue(mockDeviceWithEnrollment);
      db.DevicePolicy.findOne.mockResolvedValue(null);
      db.DevicePolicy.create.mockResolvedValue({ id: 'policy-uuid-1' });

      const result = await ProfileService.assignProfile(udid, profilePayload);

      expect(NanoMDMService.enqueueCommand).toHaveBeenCalledWith('enr-abc-123', {
        command: 'InstallProfile',
        device_udids: ['UDID-001'],
        profile: profilePayload,
      });
      expect(NanoMDMService.sendPush).toHaveBeenCalledWith('enr-abc-123');
      expect(db.Device.findOne).toHaveBeenCalledWith({
        where: { device_identifier: udid },
        paranoid: false,
      });
      expect(db.DevicePolicy.create).toHaveBeenCalledWith({
        device_id: 'device-uuid-1',
        policy_type: 'com.example.camera.restriction',
        policy_details: profilePayload,
        is_active: true,
        applied_at: expect.any(Date),
      });
      expect(result).toEqual({ command_uuid: 'cmd-123' });
    });

    it('throws NotFoundError when device is not found locally', async () => {
      db.Device.findOne.mockResolvedValue(null);

      await expect(ProfileService.assignProfile(udid, profilePayload)).rejects.toThrow(
        NotFoundError,
      );
      expect(NanoMDMService.enqueueCommand).not.toHaveBeenCalled();
    });

    it('throws when device has no enrollment ID', async () => {
      db.Device.findOne.mockResolvedValue({
        ...mockDeviceWithEnrollment,
        device_info: {},
      });

      await expect(ProfileService.assignProfile(udid, profilePayload)).rejects.toThrow(
        'No NanoMDM enrollment ID found',
      );
      expect(NanoMDMService.enqueueCommand).not.toHaveBeenCalled();
    });

    it('throws ConflictError when profile is already assigned', async () => {
      NanoMDMService.enqueueCommand.mockResolvedValue({ command_uuid: 'cmd-123' });
      db.Device.findOne.mockResolvedValue(mockDeviceWithEnrollment);
      db.DevicePolicy.findOne.mockResolvedValue({ id: 'existing-policy' });

      await expect(ProfileService.assignProfile(udid, profilePayload)).rejects.toThrow(
        ConflictError,
      );
      await expect(ProfileService.assignProfile(udid, profilePayload)).rejects.toThrow(
        'already assigned',
      );
      expect(db.DevicePolicy.create).not.toHaveBeenCalled();
    });

    it('throws when UDID is missing', async () => {
      await expect(ProfileService.assignProfile('', profilePayload)).rejects.toThrow(NotFoundError);
    });

    it('throws when profile payload is missing', async () => {
      await expect(ProfileService.assignProfile(udid, null)).rejects.toThrow(NotFoundError);
    });

    it('throws when PayloadIdentifier is missing', async () => {
      await expect(ProfileService.assignProfile(udid, {})).rejects.toThrow(NotFoundError);
    });

    it('handles push failure gracefully (non-fatal)', async () => {
      NanoMDMService.enqueueCommand.mockResolvedValue({ command_uuid: 'cmd-123' });
      NanoMDMService.sendPush.mockRejectedValue(new Error('APNs unavailable'));
      db.Device.findOne.mockResolvedValue(mockDeviceWithEnrollment);
      db.DevicePolicy.findOne.mockResolvedValue(null);
      db.DevicePolicy.create.mockResolvedValue({ id: 'policy-uuid-1' });

      const result = await ProfileService.assignProfile(udid, profilePayload);

      expect(result).toEqual({ command_uuid: 'cmd-123' });
      expect(db.DevicePolicy.create).toHaveBeenCalled();
    });
  });

  describe('removeProfile', () => {
    const udid = 'UDID-001';
    const profileIdentifier = 'com.example.camera.restriction';

    it('enqueues RemoveProfile via NanoMDM and marks DevicePolicy inactive', async () => {
      NanoMDMService.enqueueCommand.mockResolvedValue({ command_uuid: 'cmd-456' });
      NanoMDMService.sendPush.mockResolvedValue({ status: 'pushed' });
      db.Device.findOne.mockResolvedValue(mockDeviceWithEnrollment);
      const policy = { id: 'policy-uuid-1', update: mockPolicyUpdate };
      db.DevicePolicy.findOne.mockResolvedValue(policy);
      mockPolicyUpdate.mockResolvedValue(policy);

      const result = await ProfileService.removeProfile(udid, profileIdentifier);

      expect(NanoMDMService.enqueueCommand).toHaveBeenCalledWith('enr-abc-123', {
        command: 'RemoveProfile',
        device_udids: ['UDID-001'],
        profile_identifier: profileIdentifier,
      });
      expect(NanoMDMService.sendPush).toHaveBeenCalledWith('enr-abc-123');
      expect(mockPolicyUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(result).toEqual({ command_uuid: 'cmd-456' });
    });

    it('throws NotFoundError when device is not found locally', async () => {
      db.Device.findOne.mockResolvedValue(null);

      await expect(ProfileService.removeProfile(udid, profileIdentifier)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('does not fail when no active DevicePolicy exists', async () => {
      NanoMDMService.enqueueCommand.mockResolvedValue({ command_uuid: 'cmd-456' });
      NanoMDMService.sendPush.mockResolvedValue({ status: 'pushed' });
      db.Device.findOne.mockResolvedValue(mockDeviceWithEnrollment);
      db.DevicePolicy.findOne.mockResolvedValue(null);

      const result = await ProfileService.removeProfile(udid, profileIdentifier);

      expect(result).toEqual({ command_uuid: 'cmd-456' });
    });

    it('throws when UDID is missing', async () => {
      await expect(ProfileService.removeProfile('', profileIdentifier)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws when profile identifier is missing', async () => {
      await expect(ProfileService.removeProfile(udid, '')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getProfiles', () => {
    it('queries profiles from DevicePolicy table', async () => {
      const policies = [
        {
          policy_type: 'com.example.profile',
          policy_details: {
            PayloadDisplayName: 'Test Profile',
            PayloadOrganization: 'Org',
            PayloadDescription: 'Desc',
          },
          is_active: true,
          applied_at: new Date(),
          Device: {
            id: 'device-uuid-1',
            device_identifier: 'UDID-001',
            device_name: 'iPhone',
            serial_number: 'SN-123',
          },
        },
      ];
      db.DevicePolicy.findAll.mockResolvedValue(policies);

      const result = await ProfileService.getProfiles({ limit: 10 });

      expect(db.DevicePolicy.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_active: true },
        }),
      );
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].PayloadIdentifier).toBe('com.example.profile');
    });

    it('filters by device UDID when provided', async () => {
      db.Device.findOne.mockResolvedValue(mockDeviceWithEnrollment);
      db.DevicePolicy.findAll.mockResolvedValue([]);

      await ProfileService.getProfiles({ filter: { udid: 'UDID-001' } });

      expect(db.Device.findOne).toHaveBeenCalledWith({
        where: { device_identifier: 'UDID-001' },
        paranoid: false,
      });
      expect(db.DevicePolicy.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ device_id: 'device-uuid-1' }),
        }),
      );
    });

    it('returns empty when device UDID not found', async () => {
      db.Device.findOne.mockResolvedValue(null);

      const result = await ProfileService.getProfiles({ filter: { udid: 'UNKNOWN' } });

      expect(result).toEqual({ profiles: [] });
      expect(db.DevicePolicy.findAll).not.toHaveBeenCalled();
    });

    it('queries without params', async () => {
      db.DevicePolicy.findAll.mockResolvedValue([]);

      await ProfileService.getProfiles();

      expect(db.DevicePolicy.findAll).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('gets a single profile by identifier from DevicePolicy', async () => {
      const policy = {
        policy_type: 'com.example.profile',
        policy_details: {
          PayloadDisplayName: 'Test',
          PayloadOrganization: 'Org',
          PayloadDescription: 'Desc',
        },
        is_active: true,
        applied_at: new Date(),
        Device: {
          id: 'device-uuid-1',
          device_identifier: 'UDID-001',
          device_name: 'iPhone',
          serial_number: 'SN-123',
        },
      };
      db.DevicePolicy.findOne.mockResolvedValue(policy);

      const result = await ProfileService.getProfile('com.example.profile');

      expect(db.DevicePolicy.findOne).toHaveBeenCalledWith({
        where: { policy_type: 'com.example.profile', is_active: true },
        include: [expect.objectContaining({ model: db.Device })],
        order: [['created_at', 'DESC']],
      });
      expect(result.PayloadIdentifier).toBe('com.example.profile');
    });

    it('throws NotFoundError when profile is not found', async () => {
      db.DevicePolicy.findOne.mockResolvedValue(null);

      await expect(ProfileService.getProfile('unknown.profile')).rejects.toThrow(NotFoundError);
    });

    it('throws when identifier is missing', async () => {
      await expect(ProfileService.getProfile('')).rejects.toThrow(NotFoundError);
    });
  });
});
