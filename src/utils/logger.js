const winston = require('winston');
const environment = require('../../config/environment');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Console format: human-readable with colours (ANSI codes stay in stdout only)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// File format: plain text without ANSI escape codes so log files stay clean
// when PM2 (or any other process manager) captures stdout alongside them.
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`,
  ),
);

const transports = [
  // Console transport — colourised for interactive terminals / PM2 stdout
  new winston.transports.Console({ format: consoleFormat }),
  // Error log file — plain text, no ANSI codes
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: fileFormat,
  }),
  // Combined log file — plain text, no ANSI codes
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: fileFormat,
  }),
];

const logger = winston.createLogger({
  level: environment.logging.level,
  levels,
  transports,
});

module.exports = logger;
