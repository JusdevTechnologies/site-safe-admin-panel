const logger = require('../utils/logger');
const MDMCommandService = require('../services/MDMCommandService');
const db = require('../models');
const { Op } = require('sequelize');
const { ADE_ENROLLMENT_STATUS } = require('../constants');

const DEFAULT_INTERVAL_MS = 60000;

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
        this._retryFailedCommands(),
        this._cleanupExpiredEnrollments(),
        this._cleanupAuditLogs(),
        this._checkHealth(),
      ]);

      const summary = results.map((r, i) => {
        const labels = ['Commands', 'Enrollments', 'AuditLogs', 'Health'];
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

  async _retryFailedCommands() {
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);

    const staleCommands = await db.MDMCommand.findAll({
      where: {
        status: 'sent',
        sent_at: { [Op.lt]: staleThreshold },
      },
      order: [['sent_at', 'ASC']],
      limit: 50,
    });

    let retried = 0;
    for (const cmd of staleCommands) {
      if (cmd.retry_count >= cmd.max_retries) {
        continue;
      }
      try {
        await cmd.update({
          retry_count: cmd.retry_count + 1,
          status: 'queued',
          queued_at: new Date(),
        });
        retried += 1;
      } catch (err) {
        logger.warn(`[SyncScheduler] Failed to retry command ${cmd.command_uuid}: ${err.message}`);
      }
    }

    if (retried > 0) {
      logger.info(`[SyncScheduler] Retried ${retried} stale command(s)`);
    }

    return { retried };
  }

  async _cleanupExpiredEnrollments() {
    const expiryDays = 90;
    const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

    const expired = await db.AdeEnrollment.findAll({
      where: {
        status: {
          [Op.notIn]: [ADE_ENROLLMENT_STATUS.COMPLETED, ADE_ENROLLMENT_STATUS.FAILED],
        },
        updated_at: { [Op.lt]: cutoff },
      },
    });

    let cleaned = 0;
    for (const enrollment of expired) {
      try {
        await enrollment.update({
          status: ADE_ENROLLMENT_STATUS.FAILED,
          last_error: 'Enrollment expired due to inactivity',
        });
        cleaned += 1;
      } catch (err) {
        logger.warn(`[SyncScheduler] Failed to expire enrollment ${enrollment.id}: ${err.message}`);
      }
    }

    if (cleaned > 0) {
      logger.info(`[SyncScheduler] Expired ${cleaned} stale enrollment(s)`);
    }

    return { cleaned };
  }

  async _cleanupAuditLogs() {
    const retentionDays = 365;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      const deleted = await db.AuditLog.destroy({
        where: {
          created_at: { [Op.lt]: cutoff },
        },
      });

      if (deleted > 0) {
        logger.info(
          `[SyncScheduler] Cleaned up ${deleted} audit log(s) older than ${retentionDays} days`,
        );
      }

      return { deleted };
    } catch (err) {
      logger.warn(`[SyncScheduler] Audit log cleanup failed: ${err.message}`);
      return { deleted: 0 };
    }
  }

  async _checkHealth() {
    const NanoMDMService = require('../integrations/NanoMDMService');

    const health = {
      status: 'healthy',
      nanoMDM: false,
      database: false,
      checkedAt: new Date().toISOString(),
    };

    try {
      await NanoMDMService.getVersion();
      health.nanoMDM = true;
    } catch (err) {
      health.status = 'degraded';
      health.nanoMDMError = err.message;
    }

    try {
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
