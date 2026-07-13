jest.mock('../../../src/models', () => ({
  Device: {
    findOne: jest.fn(),
  },
  MDMCommand: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
  },
}));

const MDMCommandService = require('../../../src/services/MDMCommandService');
const db = require('../../../src/models');
const { Op } = require('sequelize');
const NotFoundError = require('../../../src/exceptions/NotFoundError');

const mockMDMCommandUpdate = jest.fn();

const sampleMDMCommand = (overrides = {}) => ({
  id: 'cmd-uuid-1',
  command_uuid: 'nano-uuid-123',
  device_id: 'device-uuid-1',
  device_identifier: 'UDID-001',
  command_type: 'InstallProfile',
  status: 'sent',
  request_payload: { command: 'InstallProfile', device_udids: ['UDID-001'] },
  response_data: { command_uuid: 'nano-uuid-123' },
  error_message: null,
  retry_count: 0,
  max_retries: 3,
  queued_at: null,
  sent_at: new Date('2026-07-13T00:00:00Z'),
  acknowledged_at: null,
  failed_at: null,
  created_at: new Date('2026-07-13T00:00:00Z'),
  updated_at: new Date('2026-07-13T00:00:00Z'),
  update: mockMDMCommandUpdate,
  ...overrides,
});

const expectedFormat = (record) => ({
  id: record.id,
  commandUuid: record.command_uuid,
  deviceId: record.device_id,
  deviceIdentifier: record.device_identifier,
  commandType: record.command_type,
  status: record.status,
  requestPayload: record.request_payload,
  responseData: record.response_data,
  errorMessage: record.error_message,
  retryCount: record.retry_count,
  maxRetries: record.max_retries,
  queuedAt: record.queued_at,
  sentAt: record.sent_at,
  acknowledgedAt: record.acknowledged_at,
  failedAt: record.failed_at,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

describe('MDMCommandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordCommand', () => {
    const validInput = {
      commandUuid: 'nano-uuid-456',
      commandType: 'RemoveProfile',
      deviceIdentifier: 'UDID-002',
      requestPayload: { command: 'RemoveProfile', device_udids: ['UDID-002'] },
      responseData: { command_uuid: 'nano-uuid-456' },
    };

    it('creates a command record with sent status and resolves device ID', async () => {
      db.Device.findOne.mockResolvedValue({ id: 'device-uuid-2' });
      db.MDMCommand.create.mockResolvedValue(
        sampleMDMCommand({
          command_uuid: 'nano-uuid-456',
          command_type: 'RemoveProfile',
          device_id: 'device-uuid-2',
          device_identifier: 'UDID-002',
          status: 'sent',
        }),
      );

      const result = await MDMCommandService.recordCommand(validInput);

      expect(db.Device.findOne).toHaveBeenCalledWith({
        where: { device_identifier: 'UDID-002' },
        paranoid: false,
      });
      expect(db.MDMCommand.create).toHaveBeenCalledWith({
        command_uuid: 'nano-uuid-456',
        device_id: 'device-uuid-2',
        device_identifier: 'UDID-002',
        command_type: 'RemoveProfile',
        status: 'sent',
        request_payload: { command: 'RemoveProfile', device_udids: ['UDID-002'] },
        response_data: { command_uuid: 'nano-uuid-456' },
        error_message: null,
        retry_count: 0,
        max_retries: 3,
        sent_at: expect.any(Date),
      });
      expect(result.commandUuid).toBe('nano-uuid-456');
      expect(result.status).toBe('sent');
    });

    it('creates command with queued status and sets queued_at', async () => {
      db.Device.findOne.mockResolvedValue(null);
      db.MDMCommand.create.mockResolvedValue(
        sampleMDMCommand({
          command_uuid: 'nano-uuid-789',
          command_type: 'DeviceInformation',
          status: 'queued',
          device_id: null,
          queued_at: new Date(),
        }),
      );

      const result = await MDMCommandService.recordCommand({
        commandUuid: 'nano-uuid-789',
        commandType: 'DeviceInformation',
        status: 'queued',
      });

      expect(db.MDMCommand.create).toHaveBeenCalledWith({
        command_uuid: 'nano-uuid-789',
        device_id: null,
        device_identifier: null,
        command_type: 'DeviceInformation',
        status: 'queued',
        request_payload: null,
        response_data: null,
        error_message: null,
        retry_count: 0,
        max_retries: 3,
        queued_at: expect.any(Date),
      });
      expect(result.status).toBe('queued');
    });

    it('handles device not found locally (no device ID resolved)', async () => {
      db.Device.findOne.mockResolvedValue(null);
      db.MDMCommand.create.mockResolvedValue(
        sampleMDMCommand({
          command_uuid: 'nano-uuid-999',
          device_id: null,
        }),
      );

      const result = await MDMCommandService.recordCommand(validInput);

      expect(db.Device.findOne).toHaveBeenCalled();
      expect(db.MDMCommand.create).toHaveBeenCalledWith(
        expect.objectContaining({ device_id: null }),
      );
      expect(result.deviceId).toBeNull();
    });

    it('throws when commandUuid is missing', async () => {
      await expect(MDMCommandService.recordCommand({ commandType: 'Test' })).rejects.toThrow(
        'commandUuid is required',
      );
    });

    it('throws when commandType is missing', async () => {
      await expect(MDMCommandService.recordCommand({ commandUuid: 'abc' })).rejects.toThrow(
        'commandType is required',
      );
    });
  });

  describe('getCommand', () => {
    it('retrieves a command by local UUID', async () => {
      const record = sampleMDMCommand();
      db.MDMCommand.findByPk.mockResolvedValue(record);

      const result = await MDMCommandService.getCommand('cmd-uuid-1');

      expect(db.MDMCommand.findByPk).toHaveBeenCalledWith('cmd-uuid-1');
      expect(result).toEqual(expectedFormat(record));
    });

    it('throws NotFoundError when command not found', async () => {
      db.MDMCommand.findByPk.mockResolvedValue(null);

      await expect(MDMCommandService.getCommand('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getCommandByUuid', () => {
    it('retrieves a command by NanoMDM command UUID', async () => {
      const record = sampleMDMCommand();
      db.MDMCommand.findOne.mockResolvedValue(record);

      const result = await MDMCommandService.getCommandByUuid('nano-uuid-123');

      expect(db.MDMCommand.findOne).toHaveBeenCalledWith({
        where: { command_uuid: 'nano-uuid-123' },
      });
      expect(result).toEqual(expectedFormat(record));
    });

    it('throws NotFoundError when command not found', async () => {
      db.MDMCommand.findOne.mockResolvedValue(null);

      await expect(MDMCommandService.getCommandByUuid('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getCommands', () => {
    it('returns paginated commands without filters', async () => {
      const records = [sampleMDMCommand()];
      db.MDMCommand.findAndCountAll.mockResolvedValue({ count: 1, rows: records });

      const result = await MDMCommandService.getCommands();

      expect(db.MDMCommand.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        order: [['created_at', 'DESC']],
        limit: 20,
        offset: 0,
      });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('applies status filter', async () => {
      db.MDMCommand.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await MDMCommandService.getCommands({ status: 'failed' });

      expect(db.MDMCommand.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'failed' } }),
      );
    });

    it('applies commandType filter', async () => {
      db.MDMCommand.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await MDMCommandService.getCommands({ commandType: 'InstallProfile' });

      expect(db.MDMCommand.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { command_type: 'InstallProfile' } }),
      );
    });

    it('applies deviceIdentifier filter', async () => {
      db.MDMCommand.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await MDMCommandService.getCommands({ deviceIdentifier: 'UDID-001' });

      expect(db.MDMCommand.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { device_identifier: 'UDID-001' } }),
      );
    });

    it('supports custom pagination', async () => {
      db.MDMCommand.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await MDMCommandService.getCommands({ page: 3, limit: 10 });

      expect(db.MDMCommand.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 }),
      );
    });
  });

  describe('updateCommandStatus', () => {
    it('updates status to acknowledged and sets acknowledged_at', async () => {
      const record = sampleMDMCommand({ status: 'sent', acknowledged_at: null });
      mockMDMCommandUpdate.mockResolvedValue(record);
      db.MDMCommand.findByPk.mockResolvedValue(record);

      const result = await MDMCommandService.updateCommandStatus('cmd-uuid-1', 'acknowledged');

      expect(mockMDMCommandUpdate).toHaveBeenCalledWith({
        status: 'acknowledged',
        acknowledged_at: expect.any(Date),
      });
      expect(result.status).toBe('sent');
    });

    it('updates status to failed and sets failed_at', async () => {
      const record = sampleMDMCommand({ status: 'sent', failed_at: null });
      mockMDMCommandUpdate.mockResolvedValue(record);
      db.MDMCommand.findByPk.mockResolvedValue(record);

      await MDMCommandService.updateCommandStatus('cmd-uuid-1', 'failed', {
        error_message: 'Device not responding',
        retry_count: 3,
      });

      expect(mockMDMCommandUpdate).toHaveBeenCalledWith({
        status: 'failed',
        error_message: 'Device not responding',
        retry_count: 3,
        failed_at: expect.any(Date),
      });
    });

    it('throws NotFoundError when command not found', async () => {
      db.MDMCommand.findByPk.mockResolvedValue(null);

      await expect(
        MDMCommandService.updateCommandStatus('nonexistent', 'acknowledged'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws on invalid status', async () => {
      db.MDMCommand.findByPk.mockResolvedValue(sampleMDMCommand());

      await expect(
        MDMCommandService.updateCommandStatus('cmd-uuid-1', 'invalid_status'),
      ).rejects.toThrow('Invalid status');
    });
  });

  describe('getPendingCommands', () => {
    it('returns commands not in acknowledged or failed state', async () => {
      const records = [
        sampleMDMCommand({ command_uuid: 'nano-1', status: 'sent' }),
        sampleMDMCommand({ command_uuid: 'nano-2', status: 'queued' }),
      ];
      db.MDMCommand.findAll.mockResolvedValue(records);

      const result = await MDMCommandService.getPendingCommands();

      expect(db.MDMCommand.findAll).toHaveBeenCalledWith({
        where: {
          status: {
            [Op.notIn]: ['acknowledged', 'failed'],
          },
        },
        order: [['created_at', 'ASC']],
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no pending commands', async () => {
      db.MDMCommand.findAll.mockResolvedValue([]);

      const result = await MDMCommandService.getPendingCommands();

      expect(result).toEqual([]);
    });
  });
});
