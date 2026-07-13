# Architecture Review: SiteSafe Admin Panel

> **Prepared for:** NanoMDM Integration  
> **Date:** July 13, 2026  
> **Scope:** Full-stack architecture review prior to feature development

---

## 1. Project Overview

SiteSafe Admin Panel is a Node.js/Express backend that manages Android/iOS devices for a Samsung MDM Camera Blocking application. It provides administrative controls for device camera restriction, employee management, OTP-based uninstall flows, and push notification delivery via Firebase Cloud Messaging (FCM). The system also supports mobile device registration and punch-recording for access management.

---

## 2. Technology Stack

| Layer              | Technology              | Version             |
| ------------------ | ----------------------- | ------------------- |
| Runtime            | Node.js                 | >=18                |
| Framework          | Express                 | ~4.18.2             |
| ORM                | Sequelize (with CLI)    | ^6.35.2             |
| Database           | PostgreSQL              | —                   |
| Auth               | JWT (custom middleware) | ^9.0.2              |
| Validation         | Joi                     | ^17.11.0            |
| Logging            | Winston                 | ^3.11.0             |
| Push Notifications | Firebase Admin SDK      | ^13.8.0             |
| HTTP Client        | Axios                   | ^1.7.0              |
| Linting            | ESLint + Prettier       | ^8.55.0 / ^3.1.1    |
| Testing (stub)     | Jest + Supertest        | ^29.7.0 / ^6.3.3    |
| Process Manager    | PM2                     | ecosystem.config.js |

---

## 3. Architecture: Layered (Clean Architecture)

The project follows a strict layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Transport Layer                     │
│  Middleware Stack → Routes → Controllers                    │
├─────────────────────────────────────────────────────────────┤
│                     Validation Layer                         │
│  Joi Schemas (inline middleware or controller-called)       │
├─────────────────────────────────────────────────────────────┤
│                     Business Logic Layer                     │
│  Services (orchestration, domain rules)                     │
├─────────────────────────────────────────────────────────────┤
│                     Integration Layer                        │
│  FirebaseService (external system client)                   │
├─────────────────────────────────────────────────────────────┤
│                     Data Access Layer                        │
│  Sequelize Models → PostgreSQL                              │
├─────────────────────────────────────────────────────────────┤
│                     Cross-Cutting Concerns                   │
│  Auth · Authorization · Error Handling · Logging · Rate Limiting
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **Presentation (Routes + Controllers)** — `src/routes/`, `src/controllers/`
   - Routes: Define HTTP method + path, apply middleware (auth, authorize, validation), delegate to controllers.
   - Controllers: Extract request params, call services, format HTTP responses via `formatResponse()` / `formatErrorResponse()`. Must remain thin.

2. **Validation (Validators)** — `src/validators/`
   - Joi schema definitions for request bodies, query params, and path params.
   - Applied as inline middleware in admin routes; called manually in mobile controllers.

3. **Business Logic (Services)** — `src/services/`
   - Encapsulate all domain logic, orchestration, authorization checks, and audit logging.
   - No direct HTTP concern (no `req`/`res` access).
   - Call models and integrations.

4. **Integration (External Systems)** — `src/integrations/`
   - Currently only `FirebaseService.js` — wraps Firebase Admin SDK for FCM push notifications.
   - Lazy initialization pattern. Non-blocking by design (failures logged, never rolled back).

5. **Data Access (Models)** — `src/models/`
   - Sequelize model definitions with field validations, associations, and scopes.
   - Central `index.js` initializes Sequelize instance and registers associations.

6. **Cross-Cutting (Middleware + Utils + Constants)** — `src/middleware/`, `src/utils/`, `src/constants/`
   - Middleware: Authentication, authorization, CORS, rate limiting, request logging, error handling.
   - Utils: Logger, JWT helpers, bcrypt hasher, response formatters, pagination.
   - Constants: HTTP status codes, error codes, enums, role definitions.

---

## 4. Directory Structure

```
site-safe-admin-panel/
├── bin/www                          # Server entry point
├── app.js                           * LEGACY — NOT USED (Express generator boilerplate)
├── config/
│   ├── database.js                  # Sequelize env config (dev/prod/test)
│   └── environment.js               # Env var loader + validator
├── docs/
│   ├── API.md, ARCH.md, DEPLOYMENT.md, SETUP.md
├── src/
│   ├── app.js                       # Express app setup (middleware + routes)
│   ├── constants/index.js           # Shared enums, codes, roles
│   ├── controllers/                 # Thin HTTP handlers
│   ├── exceptions/                  # Custom error classes (AppError hierarchy)
│   ├── integrations/                # External service clients
│   ├── middleware/                   # Express middleware
│   ├── migrations/                  # Sequelize migration files
│   ├── models/                      # Sequelize models + associations
│   ├── routes/                      # Express route definitions
│   ├── seeders/                     # Database seed files
│   ├── services/                    # Business logic layer
│   ├── utils/                       # Shared utilities
│   └── validators/                  # Joi validation schemas
├── tests/                           * EMPTY — no tests yet
├── postman_collection_*.json        # API test collections
└── ecosystem.config.js              # PM2 configuration
```

**Key observation:** There is a duality in route systems. The root `routes/` directory contains Express generator boilerplate (unused). The actual routes are in `src/routes/`. Similarly, root `app.js` is unused; `src/app.js` is the real application.

---

## 5. Data Flow Pattern

```
Client Request
    │
    ▼
helmet → body-parser → cors → requestLogger → cache-control → rateLimiter
    │
    ▼
Router (src/routes/)
    │
    ├── authenticate (JWT verify → req.user)
    ├── authorize(roles) (RBAC check)
    ├── validateRequest(schema) (Joi validation → 400 on failure)
    │
    ▼
Controller
    │  (extract params, call service, format response)
    ▼
Service
    │  (business logic, orchestration, audit logging)
    ▼
Model / Sequelize
    │
    ▼
PostgreSQL
    │
    ▼
formatResponse() → JSON Response
```

---

## 6. Database Schema & Relationships

### Tables (7)

| Table                | Paranoid | Key Fields                                                                                                                                 |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`              | Yes      | `id` (UUID), `username`, `email`, `password_hash`, `role` (super_admin/admin/viewer), `status`                                             |
| `employees`          | Yes      | `id` (UUID), `employee_id`, `first_name`, `last_name`, `email`, `phone`, `device_os`, `status`                                             |
| `devices`            | Yes      | `id` (UUID), `employee_id` (FK), `device_identifier`, `device_os`, `status`, `camera_blocked`, `camera_blocked_by` (FK→users), `last_sync` |
| `device_policies`    | No       | `id` (UUID), `device_id` (FK), `policy_type`, `policy_details` (JSON), `is_active`                                                         |
| `punch_records`      | No       | `id` (UUID), `employee_id` (FK), `punch_type`, `timestamp`, `location`                                                                     |
| `notification_logs`  | No       | `id` (UUID), `device_id` (FK), `notification_type`, `status`, `payload` (JSON), `fcm_message_id`, `retry_count`                            |
| `one_time_passwords` | No       | `id` (UUID), `device_id` (FK), `otp_code`, `purpose`, `is_used`, `expires_at`, `attempt_count`, `max_attempts`                             |
| `audit_logs`         | No       | `id` (UUID), `user_id` (FK), `action`, `entity_type`, `entity_id`, `changes` (JSON), `ip_address`, `status`                                |

### Associations

```
User ──< AuditLog            (nullable FK)
User ──< Device              (as: blockedByUser, nullable FK)

Employee ──< Device
Employee ──< PunchRecord

Device ──< DevicePolicy
Device ──< NotificationLog
Device ──< OneTimePassword
```

- **All IDs** are UUID v4.
- **Three models** (`User`, `Employee`, `Device`) use Sequelize `paranoid: true` (soft delete).
- **AuditLog** is append-only (no `updated_at`, no soft delete).
- **All timestamps** follow `snake_case` convention (`created_at`, `updated_at`, `deleted_at`).

---

## 7. API Design

### Base URL: `/api/v1`

### Real Endpoints (implemented)

| Group                                     | Auth | Role        |
| ----------------------------------------- | ---- | ----------- |
| `POST /auth/admin/login`                  | No   | —           |
| `POST /auth/login`                        | No   | —           |
| `POST /auth/refresh`                      | No   | —           |
| `POST /auth/logout`                       | Yes  | —           |
| `GET /auth/me`                            | Yes  | —           |
| `GET/POST /admin/dashboard/*`             | Yes  | super_admin |
| `GET /admin/devices`                      | Yes  | super_admin |
| `POST /admin/devices/:id/block`           | Yes  | super_admin |
| `POST /admin/devices/:id/unblock`         | Yes  | super_admin |
| `POST /admin/otp/generate`                | Yes  | super_admin |
| `GET /admin/otp*`                         | Yes  | super_admin |
| `GET/POST/PATCH/DELETE /admin/employees*` | Yes  | super_admin |
| `GET/POST/PATCH/DELETE /admin/users*`     | Yes  | super_admin |
| `POST /mobile/devices/register`           | No   | —           |
| `GET /mobile/devices/:identifier/status`  | No   | —           |
| `POST /mobile/devices/punch`              | No   | —           |
| `POST /mobile/devices/uninstall/*`        | No   | —           |

### Stub Endpoints (501 Not Implemented)

```
/api/v1/auth/*       — Stubs in src/routes/auth.js
/api/v1/users/*      — Stubs in src/routes/users.js
/api/v1/devices/*    — Stubs in src/routes/devices.js
/api/v1/employees/*  — Empty re-export in src/routes/employees.js
```

### Response Conventions

**Success:**

```json
{ "success": true, "message": "...", "data": {}, "meta": { "total": N, "page": N, "limit": N } }
```

**Error:**

```json
{ "success": false, "error": { "message": "...", "code": "ERROR_CODE", "statusCode": N, "details": null } }
```

- `formatResponse(data, message, meta)` — standard success formatting
- `formatErrorResponse(message, code, statusCode, details)` — standard error formatting
- Pagination via `paginate({ page, limit })` returning `{ offset, limit, page }`

---

## 8. Authentication & Authorization

### Authentication (JWT, Stateless)

- **Access token:** 15 min default expiry (configurable via `JWT_ACCESS_EXPIRY`)
- **Refresh token:** 7 day default expiry (configurable via `JWT_REFRESH_EXPIRY`)
- **Algorithm:** HS256 via `jsonwebtoken`
- **Header:** `Authorization: Bearer <token>`
- **Middleware:** `authenticate.js` — extracts token, verifies, attaches decoded payload to `req.user`
- **Passport.js** is declared in `package.json` but **not used** anywhere in the codebase

### Authorization (RBAC)

- **Roles:** `super_admin`, `admin`, `viewer` (defined in `src/constants/index.js`)
- **Middleware:** `authorize(...roles)` is a factory that checks `req.user.role` against allowed roles
- **Current state:** All admin routes require `super_admin` only — `admin` and `viewer` roles are defined but unused

---

## 9. Error Handling

### Custom Exception Hierarchy (`src/exceptions/`)

```
Error
 └── AppError (base)
       ├── ValidationError   (400, VALIDATION_ERROR)
       ├── NotFoundError     (404, NOT_FOUND)
       ├── UnauthorizedError (401, UNAUTHORIZED)
       ├── ForbiddenError    (403, FORBIDDEN)
       └── ConflictError     (409, DUPLICATE_RECORD)
```

### Global Error Handler (`src/middleware/errorHandler.js`)

Handles mapping of:

- **Joi validation errors** → 400 VALIDATION_ERROR
- **AppError instances** → structured error from `err.toJSON()`
- **JsonWebTokenError / TokenExpiredError** → 401
- **SequelizeValidationError** → 400 VALIDATION_ERROR
- **SequelizeUniqueConstraintError** → 409 DUPLICATE_RECORD
- **Unknown errors** → 500 INTERNAL_SERVER_ERROR

All errors are logged via Winston before responding.

---

## 10. Logging (`src/utils/logger.js`)

- **Library:** Winston v3
- **Levels:** error, warn, info, http, debug (configurable via `LOG_LEVEL`)
- **Transports:**
  1. Console — colorized, human-readable
  2. File (`logs/error.log`) — error level only
  3. File (`logs/combined.log`) — all levels
- **Format:** `[YYYY-MM-DD HH:mm:ss:ms] [LEVEL]: message`
- **Middleware:** `requestLogger.js` logs each request's method, URL, status, and duration

---

## 11. Coding Standards & Conventions

| Element           | Convention            | Example                                    |
| ----------------- | --------------------- | ------------------------------------------ |
| Files/Directories | camelCase             | `authController.js`, `userService.js`      |
| Classes           | PascalCase            | `class AuthService`, `class AppError`      |
| Functions/Methods | camelCase             | `getAllDevices()`, `formatResponse()`      |
| Database tables   | snake_case (plural)   | `device_policies`, `one_time_passwords`    |
| Model columns     | snake_case            | `camera_blocked`, `device_identifier`      |
| Model names       | PascalCase (singular) | `User`, `Device`, `OneTimePassword`        |
| Route paths       | kebab-case            | `/api/v1/admin/dashboard/otp-summary`      |
| URL params        | camelCase             | `:deviceId`, `:deviceIdentifier`           |
| JSON response     | camelCase             | `cameraBlocked`, `employeeId`              |
| Constants         | UPPER_SNAKE_CASE      | `HTTP_STATUS.OK`, `USER_ROLES.SUPER_ADMIN` |
| Error codes       | UPPER_SNAKE_CASE      | `VALIDATION_ERROR`, `NOT_FOUND`            |

### Code Style

- **ES6+** with CommonJS modules (`require` / `module.exports`)
- **`async/await`** with `try/catch` throughout
- **`express-async-errors`** for automatic async error propagation in routes
- **2-space indentation**, single quotes, semicolons required
- **`const`** preferred over `let`
- **Singleton exports:** `module.exports = new ClassName()`
- **Controller thinness:** Controllers only extract params, call services, format responses
- **Business logic:** Services handle orchestration, domain rules, audit logging
- **Non-blocking external calls:** Integration failures logged, never rolled back

---

## 12. Integration Points

### Existing: Firebase Cloud Messaging (`src/integrations/FirebaseService.js`)

- Lazy initialization of Firebase Admin SDK from `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string in env)
- Core method: `send(device, notification, data, event)` — persists to `NotificationLog`
- Specialized methods:
  - `sendCameraStatusNotification(device, isBlocked, adminName)`
  - `sendPunchNotification(device, punchType, location)`
  - `sendOtpPushNotification(device, otpCode)`
- Platform-specific payloads: Android (channelId `mdm_alerts`), iOS (APNs headers)
- **All notification sends are non-blocking** — errors logged but never propagate

### Planned (from .env / config)

- **MicroMDM** — `MICRO_MDM_API_KEY`, `MICRO_MDM_SERVER_URL` env vars suggest planned iOS MDM integration (not yet implemented)
- **Access Management System** — `AMS_API_KEY`, `AMS_API_URL` for punch event webhooks

---

## 13. Configuration Management

### Environment Variables (`config/environment.js`)

- **13 required vars** validated at startup (app exits if missing)
- Structured export: `environment.database.*`, `environment.jwt.*`, `environment.firebase.*`, etc.
- `.env` file loaded via `dotenv`

### Database Config (`config/database.js`)

- Three environments: `development`, `production`, `test`
- Production uses SSL with `rejectUnauthorized: false`
- Development has SQL logging enabled

### PM2 (`ecosystem.config.js`)

- Single instance (fork mode — warns against cluster mode due to in-memory rate limiter)
- Auto-restart with exponential backoff (max 10 restarts, 3s delay)
- 512 MB memory threshold restart
- Environment-specific `NODE_ENV`

---

## 14. Existing Strengths

1. **Clean layering:** Strict Controller → Service → Model separation makes the codebase predictable and navigable.
2. **Consistent error handling:** Custom exception hierarchy with a global error handler provides uniform error responses.
3. **Audit trail:** Every admin action (device block/unblock, OTP generation, etc.) writes to `AuditLog`.
4. **Non-blocking integrations:** FCM failures do not disrupt business logic — important pattern to replicate for NanoMDM.
5. **Validation:** Joi schemas catch malformed input before reaching business logic.
6. **Singleton pattern:** Consistent export pattern across all modules.
7. **Soft deletes:** Paranoid models prevent data loss.
8. **Response format consistency:** Every endpoint returns the same JSON shape.
9. **Security:** Helmet, CORS, rate limiting, JWT auth, bcrypt hashing are all in place.

---

## 15. Existing Weaknesses & Risks

1. **No test suite:** Empty `tests/` directory. No test coverage makes refactoring risky.
2. **Route duality:** Root `routes/` + `app.js` are dead code from Express generator. Confusing for new developers.
3. **Stub routes:** `auth.js`, `users.js`, `devices.js` in `src/routes/` return 501 — these shadow the real routes in `admin.js`.
4. **Inconsistent validation application:** Admin routes validate via middleware; mobile routes validate inside controllers. No unified pattern.
5. **No DI container:** Manual `require()` makes unit testing harder (no easy mock injection).
6. **Single-role usage:** `super_admin` only — `admin` and `viewer` roles defined but never used.
7. **Passport.js declared but unused:** Dependency in `package.json` with no code references.
8. **No API versioning strategy beyond v1:** No clear path for version deprecation.
9. **No database migration rollback strategy:** `db:migrate:undo` exists but no documented process.
10. **No health check depth:** `GET /health` is a basic response with no DB connection check or dependency status.

---

## 16. Recommendations for NanoMDM Integration

Based on the architecture review, the following principles should guide NanoMDM implementation:

### Do:

- **Create `src/integrations/NanoMDMService.js`** following the `FirebaseService.js` pattern (lazy init, non-blocking, dedicated integration file)
- **Create `src/services/NanoMDMService.js`** for business logic (command tracking, device sync orchestration)
- **Create `src/routes/nanomdm.js`** for NanoMDM-specific API routes
- **Create `src/middleware/nanomdmAuth.js`** if NanoMDM uses a different auth mechanism (e.g., API key)
- **Create migration files** in `src/migrations/` for any new tables (e.g., `mdm_commands`, `mdm_devices`)
- **Use existing `AuthenticateMiddleware` + `authorize()`** for admin-facing NanoMDM endpoints
- **Use existing `AuditLog`** for all NanoMDM admin actions
- **Use existing `formatResponse()` / `formatErrorResponse()`** for response consistency
- **Use existing `paginate()`** for list endpoints
- **Reuse `logger`** for all NanoMDM operations
- **Use existing `Device` model** — extend rather than duplicate

### Avoid:

- **Do NOT modify existing controllers** — create new ones for NanoMDM
- **Do NOT add business logic to routes** — keep routes as thin wiring
- **Do NOT put HTTP concerns in services** — services call integrations, not `req`/`res`
- **Do NOT duplicate audit logging** — reuse the existing `AuditLog` model
- **Do NOT introduce a new response format** — use the established pattern

### Suggested New Files:

```
src/
├── integrations/
│   └── NanoMDMService.js         # HTTP client for NanoMDM API
├── services/
│   └── NanoMDMService.js         # NanoMDM business logic
├── controllers/
│   └── NanoMDMController.js      # NanoMDM HTTP handlers
├── routes/
│   └── nanomdm.js                # NanoMDM route definitions
├── validators/
│   └── NanoMDMValidator.js       # Joi schemas for NanoMDM endpoints
├── middleware/
│   └── nanomdmAuth.js            # NanoMDM API key auth (if needed)
├── migrations/
│   └── YYYYMMDD_create_mdm_commands.js
│   └── YYYYMMDD_add_nanomdm_fields_to_devices.js
├── models/
│   └── MdmCommand.js             # Sequelize model for MDM commands
```

---

## 17. Risk Assessment for NanoMDM Integration

| Risk                                | Impact | Likelihood | Mitigation                                                         |
| ----------------------------------- | ------ | ---------- | ------------------------------------------------------------------ |
| Breaking existing device management | High   | Low        | Keep NanoMDM in separate files; integration layer isolates changes |
| Duplicating device state tracking   | Medium | Medium     | Extend existing `Device` model with NanoMDM fields                 |
| Polling conflicts                   | Medium | Medium     | Single polling scheduler; configurable interval                    |
| API key exposure                    | High   | Low        | Use existing `environment.js` pattern for secrets                  |
| No test coverage for new code       | High   | High       | Write Jest tests alongside implementation                          |
| Command tracking drift              | Medium | Medium     | Idempotent command processing with status reconciliation           |

---

## 18. Summary

The SiteSafe Admin Panel is a well-structured Express application with clean layering, consistent error handling, and good security practices. The architecture is suitable for NanoMDM integration. The integration should follow existing patterns — particularly the `FirebaseService.js` integration pattern — and extend existing models rather than duplicating them. The primary risks are the lack of test coverage and the need to maintain consistency with the established coding conventions.

> **Next step:** Phase 2 — NanoMDM Integration Layer implementation.
