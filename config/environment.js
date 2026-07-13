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

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'site-safe-admin-panel',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

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

  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  passport: {
    jwtSecret: process.env.PASSPORT_JWT_SECRET,
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  },

  mdm: {
    baseUrl: process.env.MDM_BASE_URL,
    apiKey: process.env.MDM_API_KEY,
  },

  nanomdm: {
    baseUrl: process.env.NANOMDM_BASE_URL,
    authType: process.env.NANOMDM_AUTH_TYPE || 'api_key',
    apiKey: process.env.NANOMDM_API_KEY,
    bearerToken: process.env.NANOMDM_BEARER_TOKEN || '',
    timeout: parseInt(process.env.NANOMDM_TIMEOUT, 10) || 30000,
  },

  accessManagement: {
    baseUrl: process.env.ACCESS_MANAGEMENT_BASE_URL,
    apiKey: process.env.ACCESS_MANAGEMENT_API_KEY,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'json',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3001').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // ============================================
  // Apple ADE (Automated Device Enrollment)
  // ============================================
  ade: {
    apiKey: process.env.ADE_API_KEY,
    enabled: process.env.ADE_ENABLED === 'true',

    // Organization branding
    organization: process.env.ADE_ORGANIZATION || 'Organization Name',
    organizationDisplayName: process.env.ADE_ORGANIZATION_DISPLAY_NAME || '',
    department: process.env.ADE_DEPARTMENT || '',
    supportEmail: process.env.ADE_SUPPORT_EMAIL || '',
    supportPhone: process.env.ADE_SUPPORT_PHONE || '',
    supportContact: process.env.ADE_SUPPORT_CONTACT || '',

    // Profile defaults
    profileUrl: process.env.ADE_PROFILE_URL || 'http://localhost:3000',
    checkinUrl: process.env.ADE_CHECKIN_URL || '',
    topic: process.env.ADE_TOPIC || '',
    profileVersion: parseInt(process.env.ADE_PROFILE_VERSION, 10) || 1,
    identityCertificateUuid: process.env.ADE_IDENTITY_CERT_UUID || '',
    anchorCertificates: process.env.ADE_ANCHOR_CERTS || '',

    // Enrollment behavior
    isMandatory: process.env.ADE_IS_MANDATORY !== 'false',
    supervised: process.env.ADE_SUPERVISED !== 'false',
    allowProfileRemoval: process.env.ADE_ALLOW_PROFILE_REMOVAL === 'true',
    awaitDeviceConfigured: process.env.ADE_AWAIT_DEVICE_CONFIGURED !== 'false',
    language: process.env.ADE_LANGUAGE || 'en',
    region: process.env.ADE_REGION || 'US',

    // Setup Assistant skip options (comma-separated)
    skipSetupItems: process.env.ADE_SKIP_SETUP_ITEMS || '',

    // ABM sync
    abmSyncEnabled: process.env.ADE_ABM_SYNC_ENABLED === 'true',
    abmSyncInterval: parseInt(process.env.ADE_ABM_SYNC_INTERVAL, 10) || 3600000,

    // Profile generation
    profileIdentifier: process.env.ADE_PROFILE_IDENTIFIER || 'com.kokken.mdm.enrollment',
  },

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'change-me-in-production',
  },
};
