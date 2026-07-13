# Refactoring Suggestions — SiteSafe Admin Panel

> **Scope:** All source files across Phases 1–11.  
> **Date:** 2026-07-13  
> **Goal:** Concrete, actionable improvements. No new features.

---

## S1: Fix retry counter race condition (CRITICAL)

**File:** `src/integrations/NanoMDMService.js`  
**Debt:** TD-1

### Current

```js
class NanoMDMService {
  constructor() {
    this._retryCount = 0;
  }

  async _request(config) {
    // _retryCount shared across all concurrent requests
    try {
      return await this._client(config);
    } catch (error) {
      if (this._isRetryable(error) && this._retryCount < MAX_RETRIES) {
        this._retryCount++;
        await this._getRetryDelay(error);
        return this._request(config); // recursive
      }
      throw this._mapError(error);
    }
  }
}
```

### Suggestion

Option A — Use axios-retry middleware (recommended):

```js
const axiosRetry = require('axios-retry');

_getClient() {
  if (!this._client) {
    this._client = axios.create({ ... });
    axiosRetry(this._client, {
      retries: MAX_RETRIES,
      retryDelay: (retryCount, error) => this._getRetryDelay(error, retryCount),
      retryCondition: (error) => this._isRetryable(error),
    });
  }
  return this._client;
}
```

Option B — Per-request counter via closure:

```js
async _request(config) {
  const MAX = MAX_RETRIES;
  let attempt = 0;
  const doRequest = async () => {
    try { return await this._client(config); }
    catch (error) {
      if (this._isRetryable(error) && attempt < MAX) {
        attempt++;
        await this._getRetryDelay(error, attempt);
        return doRequest();
      }
      throw this._mapError(error);
    }
  };
  return doRequest();
}
```

---

## S2: Fix DeviceController.updateCameraStatus (CRITICAL)

**File:** `src/controllers/DeviceController.js`  
**Debt:** TD-2

### Current

```js
async updateCameraStatus(req, res, next) {
  try {
    const { cameraBlocked } = req.body;
    await DeviceService.updateCameraStatus(req.params.id, cameraBlocked);  // DOES NOT EXIST
  }
}
```

### Suggestion

Route to existing methods:

```js
async updateCameraStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { cameraBlocked, reason } = req.body;
    const result = cameraBlocked
      ? await DeviceService.blockDeviceCamera(id, req.user.id, reason)
      : await DeviceService.unblockDeviceCamera(id, req.user.id, reason);
    res.json(formatResponse(result));
  } catch (error) {
    next(error);
  }
}
```

---

## S3: Fix ProfileService fire-and-forget promises (HIGH)

**File:** `src/services/ProfileService.js`  
**Debt:** TD-3

### Current

```js
_sendProfileInstalledNotification(device, profileName) {
  this._trySendNotification(
    FirebaseService.sendProfileInstalledNotification(device, profileName),
    `profile-installed for device ${device.id}, profile ${profileName}`,
  );
}
```

### Suggestion

```js
async _sendProfileInstalledNotification(device, profileName) {
  await this._trySendNotification(
    FirebaseService.sendProfileInstalledNotification(device, profileName),
    `profile-installed for device ${device.id}, profile ${profileName}`,
  );
}
```

And at call sites:

```js
// Fire-and-forget — explicitly mark as intentionally un-awaited
setImmediate(() =>
  this._sendProfileInstalledNotification(localDevice, profilePayload.PayloadIdentifier),
);
```

---

## S4: Fix \_formatProfile field ordering (HIGH)

**File:** `src/services/ProfileService.js:213–221`  
**Debt:** TD-4

### Current

```js
return {
  identifier: profileData.PayloadIdentifier,
  organization: profileData.PayloadOrganization || null,
  description: profileData.PayloadDescription || null,
  displayName: profileData.PayloadDisplayName || null,
  ...(result || {}),
};
```

### Suggestion

```js
return {
  ...(result || {}),
  identifier: profileData.PayloadIdentifier,
  organization: profileData.PayloadOrganization || null,
  description: profileData.PayloadDescription || null,
  displayName: profileData.PayloadDisplayName || null,
};
```

---

## S5: Remove default admin credentials (HIGH)

**File:** `config/environment.js`  
**Debt:** TD-5

### Current

```js
superAdmin: {
  email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
  password: process.env.SUPER_ADMIN_PASSWORD || 'change-me-in-production',
}
```

### Suggestion

```js
superAdmin: {
  get email() {
    const val = process.env.SUPER_ADMIN_EMAIL;
    if (!val) throw new Error('SUPER_ADMIN_EMAIL must be set');
    return val;
  },
  get password() {
    const val = process.env.SUPER_ADMIN_PASSWORD;
    if (!val) throw new Error('SUPER_ADMIN_PASSWORD must be set');
    return val;
  },
}
```

---

## S6: Extract \_fireAndForget helper

**File:** `src/integrations/NanoMDMService.js`  
**Debt:** TD-1 (related)

### Current

```js
// Lines 170-176
this._trackCommand(error.config, response?.data)
  .catch((err) => logger.warn(`[NanoMDM] Command tracking failed: ${err.message}`));

this._auditOperation(error.config, response?.data, ...)
  .catch((err) => logger.warn(`[NanoMDM] Audit logging failed: ${err.message}`));
```

### Suggestion

```js
_fireAndForget(promise, label) {
  promise.catch((err) =>
    logger.warn(`[NanoMDM] ${label} failed: ${err.message}`)
  );
}

// Usage:
this._fireAndForget(this._trackCommand(...), 'Command tracking');
this._fireAndForget(this._auditOperation(...), 'Audit logging');
```

---

## S7: Fix \_resolveAuditMeta URL matching (MEDIUM)

**File:** `src/integrations/NanoMDMService.js`  
**Debt:** TD-8

### Current

```js
if (url.startsWith('/v1/devices/')) {
  /* matches /v1/devices/123/commands */
}
```

### Suggestion

Use a route table with explicit path patterns:

```js
_getAuditMeta(config) {
  const { url, method } = config;
  const path = new URL(url, 'http://localhost').pathname;
  const segments = path.replace(/\/+$/, '').split('/');

  const routes = [
    { match: ['v1', 'devices'],                method: 'GET',  action: MDM_AUDIT_ACTIONS.GET_DEVICES,     entity: MDM_ENTITY_TYPES.DEVICE },
    { match: ['v1', 'devices', ':id'],          method: 'GET',  action: MDM_AUDIT_ACTIONS.GET_DEVICE,      entity: MDM_ENTITY_TYPES.DEVICE, idIndex: 2 },
    { match: ['v1', 'profiles'],               method: 'GET',  action: MDM_AUDIT_ACTIONS.GET_PROFILES,    entity: MDM_ENTITY_TYPES.PROFILE },
    { match: ['v1', 'profiles', ':id'],         method: 'GET',  action: MDM_AUDIT_ACTIONS.GET_PROFILE,     entity: MDM_ENTITY_TYPES.PROFILE, idIndex: 2 },
    { match: ['v1', 'profiles', ':id'],         method: 'PUT',  action: MDM_AUDIT_ACTIONS.UPDATE_PROFILE,  entity: MDM_ENTITY_TYPES.PROFILE, idIndex: 2 },
    { match: ['v1', 'profiles', ':id'],         method: 'DELETE', action: MDM_AUDIT_ACTIONS.DELETE_PROFILE, entity: MDM_ENTITY_TYPES.PROFILE, idIndex: 2 },
    { match: ['v1', 'commands'],               method: 'POST', action: MDM_AUDIT_ACTIONS.SEND_COMMAND,    entity: MDM_ENTITY_TYPES.COMMAND },
    { match: ['v1', 'commands', ':id'],         method: 'GET',  action: MDM_AUDIT_ACTIONS.GET_COMMAND,     entity: MDM_ENTITY_TYPES.COMMAND, idIndex: 2 },
  ];

  const route = routes.find((r) =>
    r.method === method &&
    r.match.length === segments.length &&
    r.match.every((s, i) => s === ':id' || s === segments[i])
  );

  if (!route) return { action: MDM_AUDIT_ACTIONS.UNKNOWN, entityType: MDM_ENTITY_TYPES.UNKNOWN, entityId: null };

  const entityId = route.idIndex !== undefined ? decodeURIComponent(segments[route.idIndex]) : null;
  return { action: route.action, entityType: route.entity, entityId };
}
```

---

## S8: Narrow catch in \_ensureProfileExists (MEDIUM)

**File:** `src/services/CameraRestrictionService.js`  
**Debt:** TD-7

### Current

```js
async _ensureProfileExists(identifier, payload) {
  try {
    await ProfileService.getProfile(identifier);
  } catch {
    await ProfileService.createProfile(payload);
  }
}
```

### Suggestion

```js
async _ensureProfileExists(identifier, payload) {
  try {
    await ProfileService.getProfile(identifier);
  } catch (error) {
    if (error instanceof NotFoundError) {
      await ProfileService.createProfile(payload);
      return;
    }
    throw error;  // re-throw network/auth errors
  }
}
```

---

## S9: Standardize logger prefix in DeviceService (MEDIUM)

**File:** `src/services/DeviceService.js`  
**Debt:** TD-9

Find all logger calls and add `[DeviceService]` prefix:

| Line | Current                                       | Should be                                                                            |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| 97   | `'Device created'`                            | `'[DeviceService] Device created'`                                                   |
| 158  | `'Device updated'`                            | `'[DeviceService] Device updated'`                                                   |
| 198  | `'Device camera blocked'`                     | `'[DeviceService] Device camera blocked'`                                            |
| 212  | `'FCM camera-block notification failed...'`   | `'[DeviceService] FCM camera-block notification failed...'` + change level to `warn` |
| 257  | `'Device camera unblocked'`                   | `'[DeviceService] Device camera unblocked'`                                          |
| 271  | `'FCM camera-unblock notification failed...'` | `'[DeviceService] FCM camera-unblock notification failed...'` + change to `warn`     |
| 276  | `'Error blocking device camera'`              | `'[DeviceService] Error blocking device camera'`                                     |
| 293  | `'Device deleted'`                            | `'[DeviceService] Device deleted'`                                                   |

---

## S10: Use ValidationError for parameter validation (MEDIUM)

**Files:** `src/services/MDMCommandService.js`, `src/services/ProfileService.js`  
**Debt:** TD-11

### Pattern

```js
const ValidationError = require('../exceptions/ValidationError');

// Instead of:
throw new NotFoundError('Device UDID is required');
// Use:
throw new ValidationError('Device UDID is required');

// Instead of:
throw new Error('commandUuid is required');
// Use:
throw new ValidationError('commandUuid is required');
```

---

## S11: Prevent scheduler tick overlap (LOW)

**File:** `src/scheduler/SyncScheduler.js`  
**Debt:** TD-18

### Current

```js
start() {
  this._running = true;
  this._tick();  // immediate first tick
  this._timer = setInterval(() => this._tick(), this._intervalMs);
}
```

### Suggestion

```js
async _runLoop() {
  if (!this._running) return;
  await this._tick();
  if (this._running) {
    this._timer = setTimeout(() => this._runLoop(), this._intervalMs);
  }
}

start() {
  this._running = true;
  this._runLoop();
}
```

---

## S12: Consolidate fullSync / incrementalSync (LOW)

**File:** `src/services/DeviceSyncService.js`  
**Debt:** N/A (design improvement)

### Current

`fullSync` and `incrementalSync` are nearly identical (differ only in the `since` parameter and log messages). The pattern repeats throughout (NanoMDM call → `_syncDeviceList` → logging).

### Suggestion

```js
async _fetchAndSync(label, params = {}) {
  logger.info(`[DeviceSync] Starting ${label}`);
  try {
    const devices = await NanoMDMService.getDevices(params);
    if (!devices?.length) {
      logger.info(`[DeviceSync] ${label} completed — no devices returned`);
      return { synced: 0, skipped: 0, errors: 0 };
    }
    return await this._syncDeviceList(devices);
  } catch (error) {
    logger.error(`[DeviceSync] ${label} failed: ${error.message}`);
    throw error;
  }
}

async fullSync() {
  return this._fetchAndSync('Full sync');
}

async incrementalSync(since) {
  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this._fetchAndSync('Incremental sync', { since: sinceDate.toISOString() });
}
```

---

## S13: Extract notification data builder in FirebaseService (LOW)

**File:** `src/integrations/FirebaseService.js`  
**Debt:** N/A (design improvement)

### Current

Every helper method manually constructs the `data` object with `event`, `device_id`, and `timestamp`:

```js
const data = {
  event: 'mdm_command_success',
  command_type: commandType,
  device_id: device.id,
  timestamp: new Date().toISOString(),
};
```

### Suggestion

```js
_buildData(event, extraFields = {}) {
  return {
    event,
    device_id: this._device.id,
    timestamp: new Date().toISOString(),
    ...extraFields,
  };
}
```

Then each helper becomes shorter:

```js
async sendCommandSuccessNotification(device, commandType) {
  return this.send(
    device,
    { title: 'Command Executed', body: `The ${commandType} command was executed successfully on your device.` },
    this._buildData('mdm_command_success', { command_type: commandType }),
    'mdm_command_success',
  );
}
```

---

## S14: Remove redundant dotenv.config() (LOW)

**File:** `bin/www` or `config/environment.js`  
**Debt:** TD-3 (related)

### Current

Both `bin/www:3` and `config/environment.js:1` call `require('dotenv').config()`.

### Suggestion

Remove from one location. Keep in the entry point (`bin/www`):

```js
// bin/www — keep
require('dotenv').config();
```

```js
// config/environment.js — remove
// require('dotenv').config(); ← DELETE
```

---

## S15: Sanitize audit log payloads (LOW)

**File:** `src/integrations/NanoMDMService.js:256–257`  
**Debt:** TD-19

### Current

```js
requestPayload: config.data,
responseData: data,
```

### Suggestion

Add a sanitizer:

```js
_sanitizeForAudit(obj) {
  if (!obj) return obj;
  const SENSITIVE_KEYS = ['password', 'secret', 'token', 'apiKey', 'privateKey'];
  const sanitized = JSON.parse(JSON.stringify(obj));
  const redact = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const key of Object.keys(o)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
        o[key] = '[REDACTED]';
      } else {
        redact(o[key]);
      }
    }
  };
  redact(sanitized);
  return sanitized;
}
```

---

## S16: Add missing tests for \_buildMessage (HIGH coverage gap)

**File:** `tests/unit/integrations/FirebaseService.test.js`  
**Debt:** N/A

### Suggestion

Add tests for `_buildMessage`:

```js
describe('_buildMessage', () => {
  it('builds Android-specific payload', () => {
    const msg = FirebaseService._buildMessage(
      'tok',
      'android',
      { title: 'T', body: 'B' },
      { k: 'v' },
    );
    expect(msg.token).toBe('tok');
    expect(msg.notification).toEqual({ title: 'T', body: 'B' });
    expect(msg.data).toEqual({ k: 'v' });
    expect(msg.android).toBeDefined();
    expect(msg.android.priority).toBe('high');
    expect(msg.android.notification.channelId).toBe('mdm_alerts');
    expect(msg.apns).toBeUndefined();
  });

  it('builds iOS-specific payload', () => {
    const msg = FirebaseService._buildMessage('tok', 'ios', { title: 'T', body: 'B' });
    expect(msg.apns).toBeDefined();
    expect(msg.apns.payload.aps.alert).toEqual({ title: 'T', body: 'B' });
    expect(msg.apns.payload.aps.badge).toBe(1);
    expect(msg.android).toBeUndefined();
  });

  it('coerces data values to strings', () => {
    const msg = FirebaseService._buildMessage(
      'tok',
      'android',
      { title: 'T', body: 'B' },
      { num: 42, bool: true },
    );
    expect(msg.data.num).toBe('42');
    expect(msg.data.bool).toBe('true');
  });
});
```

---

## S17: Mock FirebaseService in ProfileService and MDMCommandService tests (HIGH)

**Files:**

- `tests/unit/services/ProfileService.test.js`
- `tests/unit/services/MDMCommandService.test.js`

**Debt:** TD-6

### Suggestion

Add at the top (before any other mock or require):

```js
jest.mock('../../../src/integrations/FirebaseService', () => ({
  sendProfileInstalledNotification: jest.fn().mockResolvedValue({ success: true }),
  sendProfileRemovedNotification: jest.fn().mockResolvedValue({ success: true }),
  // or for MDMCommandService:
  sendCommandSuccessNotification: jest.fn().mockResolvedValue({ success: true }),
  sendCommandFailureNotification: jest.fn().mockResolvedValue({ success: true }),
}));
```

---

## Summary of Suggested Refactors

| #   | Area                             | Change                                | Est. effort | Priority |
| --- | -------------------------------- | ------------------------------------- | ----------- | -------- |
| S1  | NanoMDMService                   | Fix retry counter race condition      | 2h          | 🔴       |
| S2  | DeviceController                 | Fix non-existent method call          | 30m         | 🔴       |
| S3  | ProfileService                   | Fix dangling promises                 | 1h          | 🟠       |
| S4  | ProfileService                   | Fix \_formatProfile spread order      | 15m         | 🟠       |
| S5  | environment.js                   | Remove default credentials            | 30m         | 🟠       |
| S6  | NanoMDMService                   | Extract \_fireAndForget helper        | 30m         | 🟡       |
| S7  | NanoMDMService                   | Fix \_resolveAuditMeta URL matching   | 1h          | 🟡       |
| S8  | CameraRestrictionService         | Narrow catch in \_ensureProfileExists | 30m         | 🟡       |
| S9  | DeviceService                    | Standardize logger prefix             | 30m         | 🟡       |
| S10 | ProfileService/MDMCommandService | Use ValidationError                   | 1h          | 🟡       |
| S11 | SyncScheduler                    | Prevent tick overlap                  | 1h          | 🔵       |
| S12 | DeviceSyncService                | Consolidate sync methods              | 1h          | 🔵       |
| S13 | FirebaseService                  | Extract \_buildData helper            | 45m         | 🔵       |
| S14 | bin/www/env                      | Remove redundant dotenv               | 15m         | 🔵       |
| S15 | NanoMDMService                   | Sanitize audit log payloads           | 2h          | 🔵       |
| S16 | Tests                            | Add \_buildMessage tests              | 1h          | 🟠       |
| S17 | Tests                            | Mock FirebaseService                  | 30m         | 🟠       |

**Total estimated effort: ~14 hours**
