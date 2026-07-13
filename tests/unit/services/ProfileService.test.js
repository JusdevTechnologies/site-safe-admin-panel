jest.mock('../../../src/integrations/NanoMDMService', () => ({
  createProfile: jest.fn(),
  updateProfile: jest.fn(),
  deleteProfile: jest.fn(),
  installProfile: jest.fn(),
  removeProfile: jest.fn(),
  getProfiles: jest.fn(),
  getProfile: jest.fn(),
}));

jest.mock('../../../src/models', () => ({
  Device: {
    findOne: jest.fn(),
  },
  DevicePolicy: {
    findOne: jest.fn(),
    create: jest.fn(),
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

describe('ProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile', () => {
    it('creates a profile via NanoMDMService and formats the result', async () => {
      const nanoResult = { profile_uuid: 'prof-123' };
      NanoMDMService.createProfile.mockResolvedValue(nanoResult);

      const result = await ProfileService.createProfile(validProfileData);

      expect(NanoMDMService.createProfile).toHaveBeenCalledWith(validProfileData);
      expect(result).toEqual({
        identifier: 'com.example.camera.restriction',
        organization: 'SiteSafe',
        description: 'Restricts camera access',
        displayName: 'Camera Restriction Profile',
        profile_uuid: 'prof-123',
      });
    });

    it('passes validation errors from NanoMDMService', async () => {
      NanoMDMService.createProfile.mockRejectedValue(
        new Error('Profile must include a PayloadIdentifier'),
      );

      await expect(ProfileService.createProfile({ PayloadContent: {} })).rejects.toThrow(
        'Profile must include a PayloadIdentifier',
      );
    });
  });

  describe('updateProfile', () => {
    const updateData = { PayloadDisplayName: 'Updated' };

    it('updates a profile via NanoMDMService', async () => {
      NanoMDMService.updateProfile.mockResolvedValue({});

      const result = await ProfileService.updateProfile('com.example.profile', updateData);

      expect(NanoMDMService.updateProfile).toHaveBeenCalledWith('com.example.profile', updateData);
      expect(result.identifier).toBe('com.example.profile');
    });

    it('throws when identifier is missing', async () => {
      await expect(ProfileService.updateProfile('', updateData)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteProfile', () => {
    it('deletes a profile via NanoMDMService', async () => {
      NanoMDMService.deleteProfile.mockResolvedValue({ deleted: true });

      const result = await ProfileService.deleteProfile('com.example.profile');

      expect(NanoMDMService.deleteProfile).toHaveBeenCalledWith('com.example.profile');
      expect(result).toEqual({ deleted: true });
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

    it('assigns profile to device and creates DevicePolicy record', async () => {
      NanoMDMService.installProfile.mockResolvedValue({ command_uuid: 'cmd-123' });
      db.Device.findOne.mockResolvedValue({ id: 'device-uuid-1' });
      db.DevicePolicy.findOne.mockResolvedValue(null);
      db.DevicePolicy.create.mockResolvedValue({ id: 'policy-uuid-1' });

      const result = await ProfileService.assignProfile(udid, profilePayload);

      expect(NanoMDMService.installProfile).toHaveBeenCalledWith(udid, profilePayload);
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

    it('does not create DevicePolicy when device is not found locally', async () => {
      NanoMDMService.installProfile.mockResolvedValue({ command_uuid: 'cmd-123' });
      db.Device.findOne.mockResolvedValue(null);

      const result = await ProfileService.assignProfile(udid, profilePayload);

      expect(db.DevicePolicy.create).not.toHaveBeenCalled();
      expect(result).toEqual({ command_uuid: 'cmd-123' });
    });

    it('throws ConflictError when profile is already assigned', async () => {
      NanoMDMService.installProfile.mockResolvedValue({ command_uuid: 'cmd-123' });
      db.Device.findOne.mockResolvedValue({ id: 'device-uuid-1' });
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
  });

  describe('removeProfile', () => {
    const udid = 'UDID-001';
    const profileIdentifier = 'com.example.camera.restriction';

    it('removes profile from device and marks DevicePolicy inactive', async () => {
      NanoMDMService.removeProfile.mockResolvedValue({ command_uuid: 'cmd-456' });
      db.Device.findOne.mockResolvedValue({ id: 'device-uuid-1' });
      const policy = { id: 'policy-uuid-1', update: mockPolicyUpdate };
      db.DevicePolicy.findOne.mockResolvedValue(policy);
      mockPolicyUpdate.mockResolvedValue(policy);

      const result = await ProfileService.removeProfile(udid, profileIdentifier);

      expect(NanoMDMService.removeProfile).toHaveBeenCalledWith(udid, profileIdentifier);
      expect(mockPolicyUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(result).toEqual({ command_uuid: 'cmd-456' });
    });

    it('does not update DevicePolicy when device is not found locally', async () => {
      NanoMDMService.removeProfile.mockResolvedValue({});
      db.Device.findOne.mockResolvedValue(null);

      await ProfileService.removeProfile(udid, profileIdentifier);

      expect(db.DevicePolicy.findOne).not.toHaveBeenCalled();
    });

    it('does not fail when no active DevicePolicy exists', async () => {
      NanoMDMService.removeProfile.mockResolvedValue({});
      db.Device.findOne.mockResolvedValue({ id: 'device-uuid-1' });
      db.DevicePolicy.findOne.mockResolvedValue(null);

      const result = await ProfileService.removeProfile(udid, profileIdentifier);

      expect(result).toEqual({});
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
    it('queries profiles from NanoMDMService', async () => {
      const nanoResult = { profiles: [{ PayloadIdentifier: 'com.example' }] };
      NanoMDMService.getProfiles.mockResolvedValue(nanoResult);

      const result = await ProfileService.getProfiles({ limit: 10 });

      expect(NanoMDMService.getProfiles).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toEqual(nanoResult);
    });

    it('queries without params', async () => {
      NanoMDMService.getProfiles.mockResolvedValue({ profiles: [] });

      await ProfileService.getProfiles();

      expect(NanoMDMService.getProfiles).toHaveBeenCalledWith({});
    });
  });

  describe('getProfile', () => {
    it('gets a single profile by identifier', async () => {
      const nanoResult = { PayloadIdentifier: 'com.example.profile' };
      NanoMDMService.getProfile.mockResolvedValue(nanoResult);

      const result = await ProfileService.getProfile('com.example.profile');

      expect(NanoMDMService.getProfile).toHaveBeenCalledWith('com.example.profile');
      expect(result).toEqual(nanoResult);
    });

    it('throws when identifier is missing', async () => {
      await expect(ProfileService.getProfile('')).rejects.toThrow(NotFoundError);
    });
  });
});
