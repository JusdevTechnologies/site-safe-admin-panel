// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Error Codes
const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // Not found
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',

  // Conflict
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  DEVICE_ALREADY_EXISTS: 'DEVICE_ALREADY_EXISTS',

  // Server errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
};

// User Roles
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  VIEWER: 'viewer',
};

// User Status
const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

// Device OS
const DEVICE_OS = {
  ANDROID: 'android',
  IOS: 'ios',
};

// Device Status
const DEVICE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
  LOST: 'lost',
};

// Camera Status
const CAMERA_STATUS = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
};

// Notification Types
const NOTIFICATION_TYPES = {
  CAMERA_BLOCK: 'camera_block',
  CAMERA_UNBLOCK: 'camera_unblock',
  DEVICE_POLICY_UPDATE: 'device_policy_update',
};

// Notification Status
const NOTIFICATION_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  PENDING: 'pending',
};

// Punch Types
const PUNCH_TYPES = {
  PUNCH_IN: 'punch_in',
  PUNCH_OUT: 'punch_out',
};

// Audit Action Types
const AUDIT_ACTION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  GET: 'get',
};

// Entity Types for Audit
const ENTITY_TYPES = {
  USER: 'User',
  DEVICE: 'Device',
  EMPLOYEE: 'Employee',
  DEVICE_POLICY: 'DevicePolicy',
};

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  USER_ROLES,
  USER_STATUS,
  DEVICE_OS,
  DEVICE_STATUS,
  CAMERA_STATUS,
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  PUNCH_TYPES,
  AUDIT_ACTION_TYPES,
  ENTITY_TYPES,
};
