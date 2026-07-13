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
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  DEVICE_ALREADY_EXISTS: 'DEVICE_ALREADY_EXISTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  PROFILE_GENERATION_ERROR: 'PROFILE_GENERATION_ERROR',
};

// User Roles
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  VIEWER: 'viewer',
};

const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

const DEVICE_OS = {
  ANDROID: 'android',
  IOS: 'ios',
};

const DEVICE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
  LOST: 'lost',
};

const CAMERA_STATUS = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
};

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

const NOTIFICATION_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  PENDING: 'pending',
};

const PUNCH_TYPES = {
  PUNCH_IN: 'punch_in',
  PUNCH_OUT: 'punch_out',
};

const AUDIT_ACTION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  GET: 'get',
};

const ENTITY_TYPES = {
  USER: 'User',
  DEVICE: 'Device',
  EMPLOYEE: 'Employee',
  DEVICE_POLICY: 'DevicePolicy',
};

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

const MDM_ENTITY_TYPES = {
  DEVICE: 'MDM_DEVICE',
  PROFILE: 'MDM_PROFILE',
  COMMAND: 'MDM_COMMAND',
};

// ============================================
// ADE — Apple Automated Device Enrollment
// ============================================

const ADE_ENROLLMENT_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  PROFILE_GENERATED: 'profile_generated',
  PROFILE_DELIVERED: 'profile_delivered',
  ENROLLMENT_STARTED: 'enrollment_started',
  AUTHENTICATED: 'authenticated',
  CHECKIN_RECEIVED: 'checkin_received',
  MDM_CONNECTION: 'mdm_connection',
  DEVICE_CONFIGURED: 'device_configured',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const ADE_ENROLLMENT_TRANSITIONS = {
  [ADE_ENROLLMENT_STATUS.PENDING]: [
    ADE_ENROLLMENT_STATUS.ASSIGNED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.ASSIGNED]: [
    ADE_ENROLLMENT_STATUS.PROFILE_GENERATED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.PROFILE_GENERATED]: [
    ADE_ENROLLMENT_STATUS.PROFILE_DELIVERED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.PROFILE_DELIVERED]: [
    ADE_ENROLLMENT_STATUS.ENROLLMENT_STARTED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.ENROLLMENT_STARTED]: [
    ADE_ENROLLMENT_STATUS.AUTHENTICATED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.AUTHENTICATED]: [
    ADE_ENROLLMENT_STATUS.CHECKIN_RECEIVED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.CHECKIN_RECEIVED]: [
    ADE_ENROLLMENT_STATUS.MDM_CONNECTION,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.MDM_CONNECTION]: [
    ADE_ENROLLMENT_STATUS.DEVICE_CONFIGURED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.DEVICE_CONFIGURED]: [
    ADE_ENROLLMENT_STATUS.COMPLETED,
    ADE_ENROLLMENT_STATUS.FAILED,
  ],
  [ADE_ENROLLMENT_STATUS.COMPLETED]: [],
  [ADE_ENROLLMENT_STATUS.FAILED]: [],
};

const ADE_AUDIT_ACTIONS = {
  DEVICE_DISCOVERED: 'ade_device_discovered',
  DEVICE_ASSIGNED: 'ade_device_assigned',
  PROFILE_CREATED: 'ade_profile_created',
  PROFILE_UPDATED: 'ade_profile_updated',
  PROFILE_ASSIGNED: 'ade_profile_assigned',
  PROFILE_RESOLVED: 'ade_profile_resolved',
  PROFILE_GENERATED: 'ade_profile_generated',
  PROFILE_DELIVERED: 'ade_profile_delivered',
  PROFILE_DOWNLOADED: 'ade_profile_downloaded',
  ENROLLMENT_STARTED: 'ade_enrollment_started',
  ENROLLMENT_STATUS_CHANGED: 'ade_enrollment_status_changed',
  AUTHENTICATED: 'ade_authenticated',
  CHECKIN_RECEIVED: 'ade_checkin_received',
  MDM_CONNECTED: 'ade_mdm_connected',
  DEVICE_CONFIGURED: 'ade_device_configured',
  ENROLLMENT_COMPLETED: 'ade_enrollment_completed',
  ENROLLMENT_FAILED: 'ade_enrollment_failed',
  NANOMDM_EVENT_CORRELATED: 'ade_nanomdm_event_correlated',
  NANOMDM_SYNC: 'ade_nanomdm_sync',
  ABM_SYNC: 'ade_abm_sync',
  ABM_SYNC_ERROR: 'ade_abm_sync_error',
  ASSIGNMENT_UPDATED: 'ade_assignment_updated',
  CERTIFICATE_UPDATED: 'ade_certificate_updated',
};

const ADE_ENTITY_TYPES = {
  DEVICE: 'ADE_DEVICE',
  PROFILE: 'ADE_PROFILE',
  ENROLLMENT: 'ADE_ENROLLMENT',
  ASSIGNMENT: 'ADE_ASSIGNMENT',
  CERTIFICATE: 'ADE_CERTIFICATE',
};

const CERTIFICATE_TYPES = {
  IDENTITY: 'identity',
  PUSH: 'push',
  ANCHOR: 'anchor',
};

const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
};

const PROFILE_DOWNLOAD_MIME_TYPE = 'application/x-apple-aspen-config';

const SKIP_SETUP_ITEMS = {
  APPLE_ID: 'AppleID',
  APPEARANCE: 'Appearance',
  BIOMETRICS: 'Biometrics',
  DIAGNOSTICS: 'Diagnostics',
  DISPLAY_TONE: 'DisplayTone',
  ENROLLMENT: 'Enrollment',
  FILEVAULT: 'FileVault',
  ICD: 'ICDP',
  ICLOUD_STORAGE: 'ICloudStorage',
  LOCATION: 'Location',
  MESSAGE: 'Messages',
  MOVEE: 'MoveFromAndroid',
  ONBOARDING: 'Onboarding',
  PASSCODE: 'Passcode',
  PAYMENT: 'Payment',
  PRIVACY: 'Privacy',
  RESTORE: 'Restore',
  RESTORE_COMPLETED: 'RestoreCompleted',
  SCREEN_TIME: 'ScreenTime',
  SIRI: 'Siri',
  SOFTWARE_UPDATE: 'SoftwareUpdate',
  TOS: 'TOS',
  TRUST_CERTIFICATES: 'TrustCertificates',
  WATCH_MIGRATION: 'WatchMigration',
  WELCOME: 'Welcome',
  ZOOM: 'Zoom',
};

const VALID_SKIP_SETUP_ITEMS = [
  'AppleID',
  'Appearance',
  'Biometrics',
  'Diagnostics',
  'DisplayTone',
  'Enrollment',
  'FileVault',
  'ICDP',
  'ICloudStorage',
  'Location',
  'Messages',
  'MoveFromAndroid',
  'Onboarding',
  'Passcode',
  'Payment',
  'Privacy',
  'Restore',
  'RestoreCompleted',
  'ScreenTime',
  'Siri',
  'SoftwareUpdate',
  'TOS',
  'TrustCertificates',
  'WatchMigration',
  'Welcome',
  'Zoom',
];

const SKIP_SETUP_ITEM_ALIASES = {
  Message: 'Messages',
  ICD: 'ICDP',
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
  CERTIFICATE_TYPES,
  SYNC_STATUS,
  PROFILE_DOWNLOAD_MIME_TYPE,
  SKIP_SETUP_ITEMS,
  VALID_SKIP_SETUP_ITEMS,
  SKIP_SETUP_ITEM_ALIASES,
};
