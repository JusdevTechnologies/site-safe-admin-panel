jest.mock('../../../src/integrations/NanoMDMService', () => ({
  getDevices: jest.fn(),
}));

jest.mock('../../../src/services/ProfileService', () => ({
  getProfiles: jest.fn(),
  assignProfile: jest.fn(),
  removeProfile: jest.fn(),
}));

jest.mock('../../../src/services/MDMCommandService', () => ({
  getCommands: jest.fn(),
}));

const MDMController = require('../../../src/controllers/MDMController');
const NanoMDMService = require('../../../src/integrations/NanoMDMService');
const ProfileService = require('../../../src/services/ProfileService');
const MDMCommandService = require('../../../src/services/MDMCommandService');

function mockReqRes() {
  const req = { query: {}, params: {}, body: {}, user: { id: 'admin-uuid' } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('MDMController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDevices', () => {
    it('responds with devices from NanoMDMService', async () => {
      const { req, res, next } = mockReqRes();
      const devices = [{ udid: 'UDID-001', serial_number: 'SN001' }];
      NanoMDMService.getDevices.mockResolvedValue(devices);

      await MDMController.getDevices(req, res, next);

      expect(NanoMDMService.getDevices).toHaveBeenCalledWith(req.query);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'MDM devices retrieved successfully',
        data: devices,
      });
    });

    it('passes errors to next', async () => {
      const { req, res, next } = mockReqRes();
      const error = new Error('NanoMDM unavailable');
      NanoMDMService.getDevices.mockRejectedValue(error);

      await MDMController.getDevices(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getProfiles', () => {
    it('responds with profiles from ProfileService', async () => {
      const { req, res, next } = mockReqRes();
      const profiles = { profiles: [{ PayloadIdentifier: 'com.example' }] };
      ProfileService.getProfiles.mockResolvedValue(profiles);

      await MDMController.getProfiles(req, res, next);

      expect(ProfileService.getProfiles).toHaveBeenCalledWith(req.query);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('passes errors to next', async () => {
      const { req, res, next } = mockReqRes();
      ProfileService.getProfiles.mockRejectedValue(new Error('API error'));

      await MDMController.getProfiles(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('installProfile', () => {
    it('installs profile and responds with result', async () => {
      const { req, res, next } = mockReqRes();
      req.body = {
        udid: 'UDID-001',
        profilePayload: { PayloadIdentifier: 'com.example', PayloadContent: {} },
      };
      ProfileService.assignProfile.mockResolvedValue({ command_uuid: 'cmd-123' });

      await MDMController.installProfile(req, res, next);

      expect(ProfileService.assignProfile).toHaveBeenCalledWith('UDID-001', {
        PayloadIdentifier: 'com.example',
        PayloadContent: {},
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile installed successfully',
        data: { command_uuid: 'cmd-123' },
      });
    });

    it('passes errors to next', async () => {
      const { req, res, next } = mockReqRes();
      req.body = {
        udid: 'UDID-001',
        profilePayload: { PayloadIdentifier: 'com.example', PayloadContent: {} },
      };
      ProfileService.assignProfile.mockRejectedValue(new Error('Conflict'));

      await MDMController.installProfile(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('removeProfile', () => {
    it('removes profile and responds with result', async () => {
      const { req, res, next } = mockReqRes();
      req.body = { udid: 'UDID-001', profileIdentifier: 'com.example.restriction' };
      ProfileService.removeProfile.mockResolvedValue({ command_uuid: 'cmd-456' });

      await MDMController.removeProfile(req, res, next);

      expect(ProfileService.removeProfile).toHaveBeenCalledWith(
        'UDID-001',
        'com.example.restriction',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile removed successfully',
        data: { command_uuid: 'cmd-456' },
      });
    });

    it('passes errors to next', async () => {
      const { req, res, next } = mockReqRes();
      req.body = { udid: 'UDID-001', profileIdentifier: 'com.example' };
      ProfileService.removeProfile.mockRejectedValue(new Error('Not found'));

      await MDMController.removeProfile(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getCommands', () => {
    it('responds with paginated commands from MDMCommandService', async () => {
      const { req, res, next } = mockReqRes();
      req.query = { page: '2', limit: '5', status: 'sent' };
      MDMCommandService.getCommands.mockResolvedValue({
        data: [{ id: 'cmd-1', commandUuid: 'nano-1' }],
        total: 1,
        page: 2,
        limit: 5,
      });

      await MDMController.getCommands(req, res, next);

      expect(MDMCommandService.getCommands).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        status: 'sent',
        commandType: undefined,
        deviceIdentifier: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'MDM commands retrieved successfully',
        data: [{ id: 'cmd-1', commandUuid: 'nano-1' }],
        meta: { total: 1, page: 2, limit: 5 },
      });
    });

    it('uses default pagination when not specified', async () => {
      const { req, res, next } = mockReqRes();
      MDMCommandService.getCommands.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await MDMController.getCommands(req, res, next);

      expect(MDMCommandService.getCommands).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: undefined,
        commandType: undefined,
        deviceIdentifier: undefined,
      });
    });

    it('passes errors to next', async () => {
      const { req, res, next } = mockReqRes();
      MDMCommandService.getCommands.mockRejectedValue(new Error('DB error'));

      await MDMController.getCommands(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
