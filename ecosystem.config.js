'use strict';

module.exports = {
  apps: [
    {
      name: 'site-safe-admin-panel',
      script: './bin/www',

      // Run in fork mode (single instance).
      // IMPORTANT: Do NOT increase instances to > 1 (cluster mode) until the
      // rate limiter is backed by a shared store (e.g. Redis), because the
      // current in-memory store is per-process and will give each worker its
      // own independent counter.
      instances: 1,
      exec_mode: 'fork',

      // Do not watch the filesystem — use pm2 reload for deploys instead.
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],

      // Auto-restart on crash, with back-off settings.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,

      // Restart if the process exceeds this memory threshold.
      max_memory_restart: '512M',

      // PM2-managed log files (separate from the winston log files).
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment variables injected by PM2.
      // dotenv is still loaded inside the app, so actual secrets can remain
      // in the .env file on the server. Use these entries to set/override
      // NODE_ENV so the correct .env file or environment branch is used.
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      env_staging: {
        NODE_ENV: 'staging',
      },
    },
  ],
};
