const logger = require('../utils/logger');
const DeviceSyncService = require('../services/DeviceSyncService');
const MDMCommandService = require('../services/MDMCommandService');
const NanoMDMService = require('../integrations/NanoMDMService');

const DEFAULT_INTERVAL_MS = 30000;
const MAX_COMMANDS_PER_TICK = 20;

const COMMAND_STATUS_MAP = {
  Acknowledged: 'acknowledged',
  Error: 'failed',
  Failed: 'failed',
  NotNow: 'failed',
  CommandFormatError: 'failed',
};

class SyncScheduler {
  constructor(intervalMs = DEFAULT_INTERVAL_MS) {
    this._intervalMs = intervalMs;
    this._timer = null;
    this._running = false;
    this._inProgress = 0;
    this._shutdownResolve = null;
  }

  start() {
    if (this._running) return;

    this._running = true;
    logger.info(`[SyncScheduler] Started with interval ${this._intervalMs}ms`);

    this._tick();
    this._timer = setInterval(() => this._tick(), this._intervalMs);
  }

  async stop(timeoutMs = 10000) {
    if (!this._running && !this._timer) return;

    this._running = false;

    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    if (this._inProgress > 0) {
      logger.info(`[SyncScheduler] Waiting for ${this._inProgress} in-progress operation(s)`);

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs),
      );
      const waitForOps = new Promise((resolve) => {
        this._shutdownResolve = resolve;
      });

      try {
        await Promise.race([waitForOps, timeout]);
      } catch (err) {
        logger.warn('[SyncScheduler] Shutdown timed out - forcing stop');
      }
    }

    logger.info('[SyncScheduler] Stopped');
  }

  async _tick() {
    if (!this._running) return;

    this._inProgress += 1;

    try {
      const results = await Promise.allSettled([
        this._syncDevices(),
        this._syncCommands(),
        this._syncProfiles(),
        this._checkHealth(),
      ]);

      const summary = results.map((r, i) => {
        const labels = ['Devices', 'Commands', 'Profiles', 'Health'];
        return r.status === 'fulfilled'
          ? `${labels[i]}=OK`
          : `${labels[i]}=FAIL(${r.reason?.message || 'unknown'})`;
      });

      logger.info(`[SyncScheduler] Tick complete | ${summary.join(' | ')}`);
    } catch (err) {
      logger.error(`[SyncScheduler] Tick failed: ${err.message}`);
    } finally {
      this._inProgress -= 1;
      this._checkShutdown();
    }
  }

  _checkShutdown() {
    if (this._inProgress === 0 && this._shutdownResolve) {
      this._shutdownResolve();
      this._shutdownResolve = null;
    }
  }

  async _syncDevices() {
    const result = await DeviceSyncService.fullSync();
    return result;
  }

  async _syncCommands() {
    const pending = await MDMCommandService.getPendingCommands();

    if (pending.length === 0) {
      return { synced: 0 };
    }

    const batch = pending.slice(0, MAX_COMMANDS_PER_TICK);
    let synced = 0;
    let failed = 0;

    for (const cmd of batch) {
      try {
        const nanoResponse = await NanoMDMService.getCommand(cmd.commandUuid);
        const nanoStatus = nanoResponse && nanoResponse.status;
        const mappedStatus = COMMAND_STATUS_MAP[nanoStatus];

        if (mappedStatus) {
          await MDMCommandService.updateCommandStatus(cmd.id, mappedStatus, {
            response_data: nanoResponse,
          });
        }
        synced += 1;
      } catch (err) {
        logger.warn(`[SyncScheduler] Command sync failed for ${cmd.commandUuid}: ${err.message}`);
        failed += 1;
      }
    }

    logger.info(
      `[SyncScheduler] Command sync | batch=${batch.length} synced=${synced} failed=${failed}`,
    );

    return { synced, failed, total: pending.length };
  }

  async _syncProfiles() {
    const result = await NanoMDMService.getProfiles();
    return result;
  }

  async _checkHealth() {
    const health = {
      status: 'healthy',
      nanoMDM: false,
      database: false,
      checkedAt: new Date().toISOString(),
    };

    try {
      await NanoMDMService.getDevices({ limit: 1 });
      health.nanoMDM = true;
    } catch (err) {
      health.status = 'degraded';
      health.nanoMDMError = err.message;
    }

    try {
      const db = require('../models');
      await db.sequelize.authenticate();
      health.database = true;
    } catch (err) {
      health.status = 'degraded';
      health.databaseError = err.message;
    }

    return health;
  }
}

module.exports = SyncScheduler;
