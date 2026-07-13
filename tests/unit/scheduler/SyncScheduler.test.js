const mockFullSync = jest.fn();
const mockGetPendingCommands = jest.fn();
const mockUpdateCommandStatus = jest.fn();
const mockGetCommand = jest.fn();
const mockGetProfiles = jest.fn();
const mockGetDevices = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock('../../../src/services/DeviceSyncService', () => ({
  fullSync: (...args) => mockFullSync(...args),
}));

jest.mock('../../../src/services/MDMCommandService', () => ({
  getPendingCommands: (...args) => mockGetPendingCommands(...args),
  updateCommandStatus: (...args) => mockUpdateCommandStatus(...args),
}));

jest.mock('../../../src/integrations/NanoMDMService', () => ({
  getCommand: (...args) => mockGetCommand(...args),
  getProfiles: (...args) => mockGetProfiles(...args),
  getDevices: (...args) => mockGetDevices(...args),
}));

jest.mock('../../../src/models', () => ({
  sequelize: {
    authenticate: (...args) => mockAuthenticate(...args),
  },
}));

const SyncScheduler = require('../../../src/scheduler/SyncScheduler');

describe('SyncScheduler', () => {
  let scheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    scheduler = null;
  });

  afterEach(async () => {
    if (scheduler && scheduler._running) {
      await scheduler.stop(100);
    }
    jest.useRealTimers();
  });

  describe('start', () => {
    it('creates a setInterval with the configured interval', () => {
      jest.spyOn(global, 'setInterval');

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it('does not create a second interval when started twice', () => {
      jest.spyOn(global, 'setInterval');

      scheduler = new SyncScheduler(100);
      scheduler.start();
      scheduler.start();

      expect(setInterval).toHaveBeenCalledTimes(1);
    });

    it('runs the first tick immediately on start', async () => {
      mockFullSync.mockResolvedValue({ synced: 2 });
      mockGetPendingCommands.mockResolvedValue([]);
      mockGetProfiles.mockResolvedValue({ profiles: [] });
      mockGetDevices.mockResolvedValue([]);
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      // Flush pending microtasks from the first tick
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFullSync).toHaveBeenCalledTimes(1);
      expect(mockGetPendingCommands).toHaveBeenCalledTimes(1);
      expect(mockGetProfiles).toHaveBeenCalledTimes(1);
      expect(mockGetDevices).toHaveBeenCalledTimes(1);
    });

    it('runs subsequent ticks on interval', async () => {
      mockFullSync.mockResolvedValue({ synced: 0 });
      mockGetPendingCommands.mockResolvedValue([]);
      mockGetProfiles.mockResolvedValue({ profiles: [] });
      mockGetDevices.mockResolvedValue([]);
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(100);
      scheduler.start();

      // Flush first tick
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFullSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('clears the interval timer', async () => {
      jest.spyOn(global, 'clearInterval');

      scheduler = new SyncScheduler(100);
      scheduler.start();
      await scheduler.stop(100);

      expect(clearInterval).toHaveBeenCalled();
    });

    it('marks scheduler as not running', async () => {
      scheduler = new SyncScheduler(100);
      scheduler.start();
      await scheduler.stop(100);

      expect(scheduler._running).toBe(false);
    });

    it('stops safely when not started', async () => {
      scheduler = new SyncScheduler(100);
      await scheduler.stop(100);

      expect(scheduler._running).toBe(false);
    });
  });

  describe('_syncDevices', () => {
    it('calls DeviceSyncService.fullSync', async () => {
      mockFullSync.mockResolvedValue({ synced: 3 });

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._syncDevices();

      expect(mockFullSync).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ synced: 3 });
    });
  });

  describe('_syncCommands', () => {
    it('updates acknowledged commands based on NanoMDM response', async () => {
      mockGetPendingCommands.mockResolvedValue([
        { id: 'cmd-1', commandUuid: 'nano-1', status: 'sent' },
        { id: 'cmd-2', commandUuid: 'nano-2', status: 'sent' },
      ]);
      mockGetCommand
        .mockResolvedValueOnce({ command_uuid: 'nano-1', status: 'Acknowledged' })
        .mockResolvedValueOnce({ command_uuid: 'nano-2', status: 'Error' });
      mockUpdateCommandStatus.mockResolvedValue({});

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._syncCommands();

      expect(mockGetCommand).toHaveBeenCalledWith('nano-1');
      expect(mockGetCommand).toHaveBeenCalledWith('nano-2');
      expect(mockUpdateCommandStatus).toHaveBeenCalledWith('cmd-1', 'acknowledged', {
        response_data: { command_uuid: 'nano-1', status: 'Acknowledged' },
      });
      expect(mockUpdateCommandStatus).toHaveBeenCalledWith('cmd-2', 'failed', {
        response_data: { command_uuid: 'nano-2', status: 'Error' },
      });
      expect(result.synced).toBe(2);
    });

    it('does not update command when NanoMDM status is unmapped', async () => {
      mockGetPendingCommands.mockResolvedValue([
        { id: 'cmd-1', commandUuid: 'nano-1', status: 'sent' },
      ]);
      mockGetCommand.mockResolvedValue({ command_uuid: 'nano-1', status: 'Pending' });

      scheduler = new SyncScheduler(5000);
      await scheduler._syncCommands();

      expect(mockUpdateCommandStatus).not.toHaveBeenCalled();
    });

    it('handles NanoMDM errors gracefully without crashing', async () => {
      mockGetPendingCommands.mockResolvedValue([
        { id: 'cmd-1', commandUuid: 'nano-1', status: 'sent' },
      ]);
      mockGetCommand.mockRejectedValue(new Error('NanoMDM timeout'));

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._syncCommands();

      expect(mockUpdateCommandStatus).not.toHaveBeenCalled();
      expect(result.failed).toBe(1);
    });

    it('returns early when no pending commands', async () => {
      mockGetPendingCommands.mockResolvedValue([]);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._syncCommands();

      expect(result).toEqual({ synced: 0 });
      expect(mockGetCommand).not.toHaveBeenCalled();
    });

    it('processes only up to MAX_COMMANDS_PER_TICK commands', async () => {
      const commands = Array.from({ length: 25 }, (_, i) => ({
        id: `cmd-${i}`,
        commandUuid: `nano-${i}`,
        status: 'sent',
      }));
      mockGetPendingCommands.mockResolvedValue(commands);
      mockGetCommand.mockResolvedValue({ command_uuid: 'nano-x', status: 'Acknowledged' });
      mockUpdateCommandStatus.mockResolvedValue({});

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._syncCommands();

      expect(mockGetCommand).toHaveBeenCalledTimes(20);
      expect(result.synced).toBe(20);
      expect(result.total).toBe(25);
    });
  });

  describe('_syncProfiles', () => {
    it('fetches profiles from NanoMDM', async () => {
      mockGetProfiles.mockResolvedValue({ profiles: [{ id: 'prof-1' }] });

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._syncProfiles();

      expect(mockGetProfiles).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ profiles: [{ id: 'prof-1' }] });
    });
  });

  describe('_checkHealth', () => {
    it('reports healthy when both NanoMDM and DB are reachable', async () => {
      mockGetDevices.mockResolvedValue([{ udid: 'test' }]);
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._checkHealth();

      expect(result.status).toBe('healthy');
      expect(result.nanoMDM).toBe(true);
      expect(result.database).toBe(true);
    });

    it('reports degraded when NanoMDM is unreachable', async () => {
      mockGetDevices.mockRejectedValue(new Error('Connection refused'));
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.nanoMDM).toBe(false);
      expect(result.database).toBe(true);
      expect(result.nanoMDMError).toBe('Connection refused');
    });

    it('reports degraded when DB is unreachable', async () => {
      mockGetDevices.mockResolvedValue([{ udid: 'test' }]);
      mockAuthenticate.mockRejectedValue(new Error('DB connection failed'));

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.nanoMDM).toBe(true);
      expect(result.database).toBe(false);
    });
  });

  describe('tick error isolation', () => {
    it('continues other syncs when one fails', async () => {
      mockFullSync.mockRejectedValue(new Error('Device sync crash'));
      mockGetPendingCommands.mockResolvedValue([]);
      mockGetProfiles.mockResolvedValue({ profiles: [] });
      mockGetDevices.mockResolvedValue([]);
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      await Promise.resolve();
      await Promise.resolve();

      expect(mockFullSync).toHaveBeenCalled();
      expect(mockGetPendingCommands).toHaveBeenCalled();
      expect(mockGetProfiles).toHaveBeenCalled();
      expect(mockGetDevices).toHaveBeenCalled();
    });
  });

  describe('graceful shutdown', () => {
    it('stops immediately when no operations in progress', async () => {
      mockFullSync.mockResolvedValue({ synced: 0 });
      mockGetPendingCommands.mockResolvedValue([]);
      mockGetProfiles.mockResolvedValue({ profiles: [] });
      mockGetDevices.mockResolvedValue([]);
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      await Promise.resolve();
      await Promise.resolve();

      const startTime = Date.now();
      await scheduler.stop(500);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(200);
    });

    it('waits for in-flight operations on shutdown', async () => {
      let resolveDeviceSync;
      const deviceSyncPromise = new Promise((resolve) => {
        resolveDeviceSync = () => resolve({ synced: 1 });
      });
      mockFullSync.mockReturnValue(deviceSyncPromise);
      mockGetPendingCommands.mockResolvedValue([]);
      mockGetProfiles.mockResolvedValue({ profiles: [] });
      mockGetDevices.mockResolvedValue([]);
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      // Let the first tick start but not complete
      await Promise.resolve();

      const stopPromise = scheduler.stop(500);

      // Resolve running operations
      resolveDeviceSync();

      await stopPromise;

      expect(scheduler._running).toBe(false);
    });
  });
});
