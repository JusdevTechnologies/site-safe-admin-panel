const mockGetPendingCommands = jest.fn();
const mockUpdateCommandStatus = jest.fn();
const mockGetVersion = jest.fn();
const mockAuthenticate = jest.fn();
const mockMDMCommandFindAll = jest.fn();
const mockAdeEnrollmentFindAll = jest.fn();
const mockAuditLogDestroy = jest.fn();
const mockAdeEnrollmentUpdate = jest.fn();

jest.mock('../../../src/services/MDMCommandService', () => ({
  getPendingCommands: (...args) => mockGetPendingCommands(...args),
  updateCommandStatus: (...args) => mockUpdateCommandStatus(...args),
}));

jest.mock('../../../src/services/DeviceSyncService', () => ({}));

jest.mock('../../../src/integrations/NanoMDMService', () => ({
  getVersion: (...args) => mockGetVersion(...args),
}));

jest.mock('../../../src/models', () => ({
  sequelize: {
    authenticate: (...args) => mockAuthenticate(...args),
  },
  MDMCommand: {
    findAll: (...args) => mockMDMCommandFindAll(...args),
  },
  AdeEnrollment: {
    findAll: (...args) => mockAdeEnrollmentFindAll(...args),
  },
  AuditLog: {
    destroy: (...args) => mockAuditLogDestroy(...args),
  },
}));

jest.mock('sequelize', () => {
  const actual = jest.requireActual('sequelize');
  return {
    ...actual,
    Op: actual.Op,
  };
});

jest.mock('../../../src/constants', () => ({
  ADE_ENROLLMENT_STATUS: {
    COMPLETED: 'completed',
    FAILED: 'failed',
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
      mockMDMCommandFindAll.mockResolvedValue([]);
      mockAdeEnrollmentFindAll.mockResolvedValue([]);
      mockAuditLogDestroy.mockResolvedValue(0);
      mockGetVersion.mockResolvedValue({ version: '1.0.0' });
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      await Promise.resolve();
      await Promise.resolve();

      expect(mockGetVersion).toHaveBeenCalledTimes(1);
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('runs subsequent ticks on interval', async () => {
      mockMDMCommandFindAll.mockResolvedValue([]);
      mockAdeEnrollmentFindAll.mockResolvedValue([]);
      mockAuditLogDestroy.mockResolvedValue(0);
      mockGetVersion.mockResolvedValue({ version: '1.0.0' });
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(100);
      scheduler.start();

      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockGetVersion).toHaveBeenCalledTimes(2);
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

  describe('_retryFailedCommands', () => {
    it('retries stale sent commands', async () => {
      const staleCmd = {
        id: 'cmd-1',
        command_uuid: 'nano-1',
        status: 'sent',
        retry_count: 1,
        max_retries: 3,
        update: jest.fn().mockResolvedValue({}),
      };
      mockMDMCommandFindAll.mockResolvedValue([staleCmd]);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._retryFailedCommands();

      expect(mockMDMCommandFindAll).toHaveBeenCalled();
      expect(staleCmd.update).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: expect.anything(),
          status: 'queued',
        }),
      );
      expect(result.retried).toBe(1);
    });

    it('handles empty stale command list', async () => {
      mockMDMCommandFindAll.mockResolvedValue([]);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._retryFailedCommands();

      expect(result.retried).toBe(0);
    });
  });

  describe('_cleanupExpiredEnrollments', () => {
    it('expires stale enrollments', async () => {
      const expiredEnrollment = {
        id: 'enr-1',
        status: 'pending',
        update: mockAdeEnrollmentUpdate,
      };
      mockAdeEnrollmentFindAll.mockResolvedValue([expiredEnrollment]);
      mockAdeEnrollmentUpdate.mockResolvedValue(expiredEnrollment);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._cleanupExpiredEnrollments();

      expect(mockAdeEnrollmentFindAll).toHaveBeenCalled();
      expect(mockAdeEnrollmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          last_error: 'Enrollment expired due to inactivity',
        }),
      );
      expect(result.cleaned).toBe(1);
    });

    it('handles empty expired enrollment list', async () => {
      mockAdeEnrollmentFindAll.mockResolvedValue([]);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._cleanupExpiredEnrollments();

      expect(result.cleaned).toBe(0);
    });
  });

  describe('_cleanupAuditLogs', () => {
    it('deletes old audit logs', async () => {
      mockAuditLogDestroy.mockResolvedValue(100);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._cleanupAuditLogs();

      expect(mockAuditLogDestroy).toHaveBeenCalled();
      expect(result.deleted).toBe(100);
    });

    it('handles cleanup errors gracefully', async () => {
      mockAuditLogDestroy.mockRejectedValue(new Error('DB error'));

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._cleanupAuditLogs();

      expect(result.deleted).toBe(0);
    });
  });

  describe('_checkHealth', () => {
    it('reports healthy when both NanoMDM and DB are reachable', async () => {
      mockGetVersion.mockResolvedValue({ version: '1.0.0' });
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._checkHealth();

      expect(result.status).toBe('healthy');
      expect(result.nanoMDM).toBe(true);
      expect(result.database).toBe(true);
    });

    it('reports degraded when NanoMDM is unreachable', async () => {
      mockGetVersion.mockRejectedValue(new Error('Connection refused'));
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.nanoMDM).toBe(false);
      expect(result.database).toBe(true);
      expect(result.nanoMDMError).toBe('Connection refused');
    });

    it('reports degraded when DB is unreachable', async () => {
      mockGetVersion.mockResolvedValue({ version: '1.0.0' });
      mockAuthenticate.mockRejectedValue(new Error('DB connection failed'));

      scheduler = new SyncScheduler(5000);
      const result = await scheduler._checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.nanoMDM).toBe(true);
      expect(result.database).toBe(false);
    });
  });

  describe('tick error isolation', () => {
    it('continues other tasks when one fails', async () => {
      mockMDMCommandFindAll.mockRejectedValue(new Error('Command sync crash'));
      mockAdeEnrollmentFindAll.mockResolvedValue([]);
      mockAuditLogDestroy.mockResolvedValue(0);
      mockGetVersion.mockResolvedValue({ version: '1.0.0' });
      mockAuthenticate.mockResolvedValue(undefined);

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      await Promise.resolve();
      await Promise.resolve();

      expect(mockGetVersion).toHaveBeenCalled();
      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockMDMCommandFindAll).toHaveBeenCalled();
    });
  });

  describe('graceful shutdown', () => {
    it('stops immediately when no operations in progress', async () => {
      mockMDMCommandFindAll.mockResolvedValue([]);
      mockAdeEnrollmentFindAll.mockResolvedValue([]);
      mockAuditLogDestroy.mockResolvedValue(0);
      mockGetVersion.mockResolvedValue({ version: '1.0.0' });
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
      let resolveHealthCheck;
      const healthCheckPromise = new Promise((resolve) => {
        resolveHealthCheck = () => resolve({ status: 'healthy', nanoMDM: true, database: true });
      });
      mockGetVersion.mockReturnValue(healthCheckPromise);
      mockAuthenticate.mockResolvedValue(undefined);
      mockMDMCommandFindAll.mockResolvedValue([]);
      mockAdeEnrollmentFindAll.mockResolvedValue([]);
      mockAuditLogDestroy.mockResolvedValue(0);

      scheduler = new SyncScheduler(5000);
      scheduler.start();

      await Promise.resolve();

      const stopPromise = scheduler.stop(500);

      resolveHealthCheck();

      await stopPromise;

      expect(scheduler._running).toBe(false);
    });
  });
});
