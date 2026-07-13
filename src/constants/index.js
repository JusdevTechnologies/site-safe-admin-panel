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
  MDM_COMMAND_SUCCESS: 'mdm_command_success',
  MDM_COMMAND_FAILURE: 'mdm_command_failure',
  MDM_PROFILE_INSTALLED: 'mdm_profile_installed',
  MDM_PROFILE_REMOVED: 'mdm_profile_removed',
  MDM_DEVICE_OFFLINE: 'mdm_device_offline',
  MDM_DEVICE_ONLINE: 'mdm_device_online',
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

// MDM Audit Action Types
const MDM_AUDIT_ACTIONS = {
  GET_DEVICES: 'nanomdm_get_devices',
  GET_DEVICE: 'nanomdm_get_device',
  GET_PROFILES: 'nanomdm_get_profiles',
  GET_PROFILE: 'nanomdm_get_profile',
  CREATE_PROFILE: 'nanomdm_create_profile',
  UPDATE_PROFILE: 'nanomdm_update_profile',
  DELETE_PROFILE: 'nanomdm_delete_profile',
  INSTALL_PROFILE: 'nanomdm_install_profile',
  REMOVE_PROFILE: 'nanomdm_remove_profile',
  SEND_COMMAND: 'nanomdm_send_command',
  GET_COMMAND: 'nanomdm_get_command',
  GET_COMMANDS: 'nanomdm_get_commands',
};

// MDM Entity Types
const MDM_ENTITY_TYPES = {
  DEVICE: 'MDM_DEVICE',
  PROFILE: 'MDM_PROFILE',
  COMMAND: 'MDM_COMMAND',
};

// ADE Enrollment Status
const ADE_ENROLLMENT_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  ENROLLMENT_STARTED: 'enrollment_started',
  CHECKIN_RECEIVED: 'checkin_received',
  MDM_CONNECTION: 'mdm_connection',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const ADE_ENROLLMENT_TRANSITIONS = {
  [ADE_ENROLLMENT_STATUS.PENDING]: [ADE_ENROLLMENT_STATUS.ASSIGNED, ADE_ENROLLMENT_STATUS.FAILED],
  [ADE_ENROLLMENT_STATUS.ASSIGNED]: [
    ADE_ENROLLMENT_STATUS.ENROLLMENT_STARTED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.ENROLLMENT_STARTED]: [
    ADE_ENROLLMENT_STATUS.CHECKIN_RECEIVED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.CHECKIN_RECEIVED]: [
    ADE_ENROLLMENT_STATUS.MDM_CONNECTION,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.MDM_CONNECTION]: [
    ADE_ENROLLMENT_STATUS.COMPLETED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.COMPLETED]: [],
  [ADE_ENROLLMENT_STATUS.FAILED]: [],
};

// ADE Audit Action Types
const ADE_AUDIT_ACTIONS = {
  DEVICE_DISCOVERED: 'ade_device_discovered',
  DEVICE_ASSIGNED: 'ade_device_assigned',
  PROFILE_CREATED: 'ade_profile_created',
  PROFILE_UPDATED: 'ade_profile_updated',
  PROFILE_ASSIGNED: 'ade_profile_assigned',
  ENROLLMENT_STARTED: 'ade_enrollment_started',
  ENROLLMENT_STATUS_CHANGED: 'ade_enrollment_status_changed',
  CHECKIN_RECEIVED: 'ade_checkin_received',
  ENROLLMENT_COMPLETED: 'ade_enrollment_completed',
  ENROLLMENT_FAILED: 'ade_enrollment_failed',
  NANOMDM_SYNC: 'ade_nanomdm_sync',
};

// ADE Entity Types
const ADE_ENTITY_TYPES = {
  DEVICE: 'ADE_DEVICE',
  PROFILE: 'ADE_PROFILE',
  ENROLLMENT: 'ADE_ENROLLMENT',
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
  MDM_AUDIT_ACTIONS,
  MDM_ENTITY_TYPES,
  ADE_ENROLLMENT_STATUS,
  ADE_ENROLLMENT_TRANSITIONS,
  ADE_AUDIT_ACTIONS,
  ADE_ENTITY_TYPES,
};
