require('dotenv').config();

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USERNAME',
  'DB_PASSWORD',
  'JWT_SECRET',
  'PASSPORT_JWT_SECRET',
];

// Check for required environment variables
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'site-safe-admin-panel',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  // Database
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    name: process.env.DB_NAME,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    dialect: process.env.DB_DIALECT || 'postgres',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // Passport
  passport: {
    jwtSecret: process.env.PASSPORT_JWT_SECRET,
  },

  // Firebase Cloud Messaging
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Private key stored in .env as a single line with literal \n characters
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  },

  // MDM
  mdm: {
    baseUrl: process.env.MDM_BASE_URL,
    apiKey: process.env.MDM_API_KEY,
  },

  // Access Management
  accessManagement: {
    baseUrl: process.env.ACCESS_MANAGEMENT_BASE_URL,
    apiKey: process.env.ACCESS_MANAGEMENT_API_KEY,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'json',
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3001').split(','),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Super Admin
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'change-me-in-production',
  },
};
