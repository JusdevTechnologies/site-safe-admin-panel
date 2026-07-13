# Technical Debt — SiteSafe Admin Panel

> **Scope:** All code written or modified across Phases 1–11.  
> **Date:** 2026-07-13

---

## Priority Legend

| Label           | Meaning                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| 🔴 **CRITICAL** | Causes incorrect runtime behavior or data loss. Fix immediately.              |
| 🟠 **HIGH**     | Degrades correctness, test reliability, or security posture. Fix this sprint. |
| 🟡 **MEDIUM**   | Violates project conventions or best practices. Fix this quarter.             |
| 🔵 **LOW**      | Cosmetic or speculative improvements. Address opportunistically.              |

---

## 🔴 Critical

### TD-1: Shared mutable retry counter in NanoMDMService

**File:** `src/integrations/NanoMDMService.js:17`  
**Introduced:** Phase 2  
**Cost:** ~2 hours to fix

`_retryCount` is a singleton instance variable. Concurrent requests during retries corrupt the counter, causing premature retry exhaustion or infinite retries.

**Debt:** Race condition that will manifest under load. Testing hasn't caught it because tests likely don't exercise concurrent retry paths.

**Fix:** Move retry tracking into a per-request closure or use axios-retry middleware.

### TD-2: DeviceController calls non-existent method

**File:** `src/controllers/DeviceController.js:114`  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~30 minutes to fix

`DeviceController.updateCameraStatus` calls `DeviceService.updateCameraStatus()` which does not exist. This route will always return 500.

**Debt:** The route is dead code that will crash if hit. Testing missed this because the controller's error path test likely used a generic mock that doesn't verify method existence.

**Fix:** Route to `blockDeviceCamera`/`unblockDeviceCamera` based on the boolean, or add the missing method.

---

## 🟠 High

### TD-3: Dangling fire-and-forget promises in ProfileService

**File:** `src/services/ProfileService.js:108,157`  
**Introduced:** Phase 11  
**Cost:** ~1 hour to fix

`_sendProfileInstalledNotification` and `_sendProfileRemovedNotification` are synchronous wrappers that call `_trySendNotification` without returning or catching the promise. If `_trySendNotification` had a synchronous throw (it doesn't currently, but future changes could introduce one), this would cause an unhandled promise rejection.

**Debt:** Brittle — the safety depends on the async function implementation, not the call contract.

**Fix:** Make the helpers `async` and `await` the promise, or return the promise for upstream catching.

### TD-4: \_formatProfile spread ordering

**File:** `src/services/ProfileService.js:213–221`  
**Introduced:** Phase 5  
**Cost:** ~15 minutes to fix

```js
return {
  identifier: profileData.PayloadIdentifier,
  ...
  ...(result || {}),  // overwrites local fields
};
```

The API response fields (`result`) overwrite the locally formatted fields. This means if NanoMDM returns fields named `identifier`, `organization`, etc., the local formatting is silently discarded.

**Debt:** Subtle bug that only manifests when NanoMDM returns certain field names — likely masked by the fact that current responses use different casing/naming.

**Fix:** Swap the spread order.

### TD-5: Hardcoded default admin credentials

**File:** `config/environment.js:110–112`  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~30 minutes to fix

```js
email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
password: process.env.SUPER_ADMIN_PASSWORD || 'change-me-in-production',
```

In any environment where these env vars are not set (e.g., a fresh staging deploy), the server starts with well-known default credentials.

**Debt:** Critical production security risk. An attacker who gains network access can authenticate with `admin@example.com` / `change-me-in-production`.

**Fix:** Remove defaults, throw at startup if not configured.

### TD-6: FirebaseService not mocked in service tests

**Files:**

- `tests/unit/services/ProfileService.test.js`
- `tests/unit/services/MDMCommandService.test.js`

**Introduced:** Phase 11  
**Cost:** ~30 minutes to fix

Both test suites call `FirebaseService` methods without mocking. The firebase-admin SDK is not initialized in these test contexts, meaning these calls either silently fail or produce unhandled rejections.

**Debt:** Tests have uncontrolled side effects. Results may be non-deterministic depending on execution environment.

**Fix:** Add `jest.mock('../../../src/integrations/FirebaseService')` to both files.

---

## 🟡 Medium

### TD-7: \_ensureProfileExists catches all errors

**File:** `src/services/CameraRestrictionService.js:30–37`  
**Introduced:** Phase 6  
**Cost:** ~30 minutes to fix

```js
try {
  await ProfileService.getProfile(identifier);
} catch {
  await ProfileService.createProfile(payload);
} // on ANY error
```

Network errors, auth failures, and timeouts are indistinguishable from "profile not found." The code behaves incorrectly for transient errors.

**Debt:** Masks real failures with misleading symptoms (createProfile will likely fail with a different error).

**Fix:** Narrow catch to `NotFoundError`.

### TD-8: URL path matching in \_resolveAuditMeta

**File:** `src/integrations/NanoMDMService.js:199–243`  
**Introduced:** Phase 10  
**Cost:** ~1 hour to fix

```js
if (url.startsWith('/v1/devices/'))  // false match: /v1/devices/abc/commands
```

Nested API paths produce incorrect audit entity type and ID.

**Debt:** Audit records for sub-resource operations (e.g., device commands) are tagged with the wrong entity type.

**Fix:** Use path segment counting or regex to distinguish exact `/v1/devices/:id` from `/v1/devices/:id/commands`.

### TD-9: Missing [DeviceService] logger prefix

**File:** `src/services/DeviceService.js` (lines 97, 158, 198, 257, 276, 293)  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~30 minutes to fix

DeviceService log messages are bare strings like `'Device created'` instead of `'[DeviceService] Device created'`.

**Debt:** Logs from DeviceService are harder to filter and grep than logs from any other service.

**Fix:** Prepend `[DeviceService]` to all log messages.

### TD-10: logger.error for non-fatal notifications

**File:** `src/services/DeviceService.js:212,271`  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~15 minutes to fix

Non-fatal FCM notification failures are logged at `error` level. Other services (ProfileService, MDMCommandService) correctly use `warn`.

**Debt:** Inconsistent error levels trigger false alerts in monitoring systems.

**Fix:** Change to `logger.warn`.

### TD-11: Wrong error types for parameter validation

**Files:**

- `src/services/MDMCommandService.js:19,22` — generic `Error` instead of `ValidationError`
- `src/services/ProfileService.js:29,46,66,126,128` — `NotFoundError` instead of `ValidationError`

**Introduced:** Phases 5, 7  
**Cost:** ~1 hour to fix

Missing required parameters throw `Error` or `NotFoundError` instead of `ValidationError`. This means API consumers receive 404s for what are clearly 400 errors.

**Debt:** Confusing API behavior. Callers get wrong HTTP status codes.

**Fix:** Import and use `ValidationError`.

### TD-12: bin/www sync({ alter: true })

**File:** `bin/www:14`  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~2 hours to fix

```js
db.sequelize.sync({ alter: environment.nodeEnv === 'development' });
```

Sequelize `alter` can drop columns and change types. A developer making model changes can lose data without realizing it.

**Debt:** Potential data loss during development. The project already has proper migrations — `sync` is redundant.

**Fix:** Remove `sync` entirely. Use only migrations.

### TD-13: Missing composite indexes

**Tables affected:** `notification_logs`, `mdm_commands`, `device_policies`, `one_time_passwords`  
**Introduced:** Pre-Phase 1 / Phase 7  
**Cost:** ~2 hours per index (migration + verification)

| Table                | Missing index                   | Query pattern                        |
| -------------------- | ------------------------------- | ------------------------------------ |
| `notification_logs`  | `(device_id, status)`           | Check notification status per device |
| `notification_logs`  | `(status)`                      | Count pending/failed notifications   |
| `mdm_commands`       | `(device_id, status)`           | Find pending commands for a device   |
| `device_policies`    | `(policy_type, is_active)`      | Find active policies by type         |
| `one_time_passwords` | `(device_id, purpose, is_used)` | Find unused OTPs for a device        |

**Debt:** These queries will perform full table scans as data grows.

---

## 🔵 Low

### TD-14: Unused constants

**File:** `src/constants/index.js`  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~15 minutes to audit and clean

- `CAMERA_STATUS` (LOCKED/UNLOCKED) — defined but the codebase uses `camera_blocked` boolean
- `AUDIT_ACTION_TYPES` (CREATE/UPDATE/DELETE/LOGIN/LOGOUT/GET) — never referenced
- `ENTITY_TYPES` (USER/DEVICE/EMPLOYEE/DEVICE_POLICY) — never referenced
- `NOTIFICATION_TYPES` — partially used (camera_block/camera_unblock are unused)

**Debt:** Confuses future developers about which constants are live vs. dead.

### TD-15: AppError barrel import

**File:** `src/exceptions/AppError.js:1`  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~15 minutes

Imports from `./index` (a re-export barrel) instead of directly from `../constants`. All sibling exception files import directly.

**Debt:** Inconsistent import style within the same directory.

### TD-16: Response shape mismatch

**File:** `src/routes/admin.js:30`  
**Introduced:** Pre-Phase 1 (inherited)  
**Cost:** ~1 hour

Validation errors return `{ success: false, message, errors }` while all controller responses use `{ success, data, message }` via `formatResponse`.

**Debt:** API consumers must handle two different error response shapes.

### TD-17: mdm_commands.status is STRING instead of ENUM

**File:** `src/migrations/20260713_create_mdm_commands.js`  
**Introduced:** Phase 7  
**Cost:** ~1 hour (new migration + model update)

`status` column uses `STRING(50)` instead of ENUM. Every other status-like column in the schema uses ENUM.

**Debt:** No database-level constraint on status values. Invalid status values can be written.

### TD-18: Scheduler ticks can overlap

**File:** `src/scheduler/SyncScheduler.js:32`  
**Introduced:** Phase 8  
**Cost:** ~1 hour

Uses `setInterval` which queues the next tick regardless of whether the current tick has completed. A slow tick (>30s) will cause overlapping ticks.

**Debt:** Resource contention under load. Currently mitigated by `Promise.allSettled` but not prevented.

### TD-19: Sensitive data in audit logs

**File:** `src/integrations/NanoMDMService.js:256–257`  
**Introduced:** Phase 10  
**Cost:** ~2 hours to review + implement filtering

Request payloads and response data are stored verbatim in `AuditLog.changes`. Profile payloads may contain configuration data (passwords, URLs, etc.) that should not be persisted indefinitely.

**Debt:** Long-term storage of sensitive configuration data in audit logs.

### TD-20: Index naming inconsistency

**Files:** All migration files  
**Introduced:** Pre-Phase 1 through Phase 7  
**Cost:** ~1 hour (documentation only — naming doesn't affect behavior)

Early migrations use Sequelize auto-generated index names. Later migrations (Phases 7–8) use explicit names. Mixed conventions make schema introspection harder.

**Debt:** Cosmetic inconsistency only — no functional impact.

---

## Summary

| Priority    | Count  | Estimated effort |
| ----------- | ------ | ---------------- |
| 🔴 Critical | 2      | 2.5 hours        |
| 🟠 High     | 4      | 2.75 hours       |
| 🟡 Medium   | 7      | 8.75 hours       |
| 🔵 Low      | 7      | 6.25 hours       |
| **Total**   | **20** | **~20 hours**    |

### Quick wins (< 1 hour each)

1. TD-4: `_formatProfile` spread order (15 min)
2. TD-10: Log level for notification failures (15 min)
3. TD-6: Mock FirebaseService in tests (30 min)
4. TD-9: Add `[DeviceService]` prefix (30 min)
5. TD-14: Remove unused constants (15 min)
6. TD-15: Fix AppError import (15 min)

### Security items (fix first)

1. TD-5: Remove default admin credentials
2. TD-19: Sanitize audit log payloads
