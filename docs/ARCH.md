# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Native Mobile Apps                       │
│              (Android & iOS - Camera Control)                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐  ┌────────────────┐  ┌─────────────┐
│ Android │  │ Azure Notif.   │  │  MicroMDM   │
│DM Policy│  │     Hubs       │  │   (iOS)     │
└─────────┘  └────────────────┘  └─────────────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
     ┌───────────────▼────────────────┐
     │  Site Safe Admin Panel Backend  │
     │     (Express.js Middleware)    │
     │                                │
     │  ┌─────────┐  ┌──────────────┐ │
     │  │ Auth    │  │ Device Mgmt  │ │
     │  │ (JWT)   │  │              │ │
     │  └─────────┘  └──────────────┘ │
     │                                │
     │  ┌──────────────────────────┐  │
     │  │  Notification Service    │  │
     │  │  (Azure Hub Integration) │  │
     │  └──────────────────────────┘  │
     │                                │
     │  ┌──────────────────────────┐  │
     │  │  Webhook Handler         │  │
     │  │  (Access Management)     │  │
     │  └──────────────────────────┘  │
     └────────────┬─────────────────────┘
                  │
     ┌────────────┼─────────────────┐
     │            │                 │
     ▼            ▼                 ▼
┌──────────┐ ┌────────────┐ ┌─────────────┐
│PostgreSQL│ │ Redis      │ │Access Mgmt  │
│Database  │ │(Optional)  │ │System API   │
└──────────┘ └────────────┘ └─────────────┘
```

## Layer Architecture

### 1. Presentation Layer
- REST API endpoints
- Request/response formatting
- Input validation
- HTTP status codes

### 2. Authentication & Authorization Layer
- JWT token generation/verification
- Passport.js integration
- Role-based access control (RBAC)
- Token refresh mechanism

### 3. Business Logic Layer
- Services for each domain (Auth, User, Device, Employee)
- Notification orchestration
- Device policy management
- Webhook processing

### 4. Integration Layer
- Azure Notification Hubs SDK
- MicroMDM API client
- Access Management system client
- External webhook handlers

### 5. Data Access Layer
- Sequelize ORM models
- Repository pattern (future enhancement)
- Database transactions
- Connection pooling

### 6. Middleware & Utility Layer
- Error handling
- Logging (Winston)
- Request logging (Morgan)
- Security headers (Helmet)
- Rate limiting
- CORS handling

## Data Flow

### Scenario 1: Employee Punch-In/Out

```
1. Access Management System
   └─> Webhook: POST /api/v1/webhooks/punch-clock
       
2. WebhookController receives punch event
   └─> Extract employee & punch type
   
3. PunchClockService processes event
   └─> Create PunchRecord
   └─> Determine camera action (lock/unlock)
   
4. NotificationService sends notification
   └─> Retrieve employee's device
   └─> Prepare notification payload
   
5. Publishing to Azure Notification Hubs
   ├─> Android: Direct device owner policy
   └─> iOS: MicroMDM API call
   
6. Mobile app receives notification
   ├─> Android: Apply camera policy
   └─> iOS: Wait for MicroMDM response
   
7. Update NotificationLog with status
```

### Scenario 2: User Login

```
1. Client: POST /api/v1/auth/login
   
2. AuthController validates credentials
   └─> Call AuthService.login()
   
3. AuthService
   ├─> Query User from database
   ├─> Verify password hash
   ├─> Check user status
   └─> Generate JWT tokens
   
4. Response with tokens
   ├─> Access Token (15min TTL)
   ├─> Refresh Token (7 days TTL)
   └─> User profile
   
5. Client stores tokens securely
   └─> Access token in memory
   └─> Refresh token in secure storage
```

### Scenario 3: Device Management

```
1. Client: GET /api/v1/devices
   └─> Include JWT in Authorization header
   
2. AuthMiddleware verifies token
   └─> Extract userId, role from JWT
   
3. DeviceController.getAllDevices()
   └─> Call DeviceService.getAllDevices()
   
4. DeviceService queries database
   ├─> Fetch devices with employee details
   ├─> Include latest notification logs
   └─> Apply pagination
   
5. Format response data
   └─> Map Sequelize models to DTO
   
6. Return formatted response
```

## Service Structure

### AuthService
- `register(userData)` - Register new user
- `login(username, password)` - Authenticate user
- `refreshToken(token)` - Refresh access token
- `getCurrentUser(userId)` - Retrieve user profile

### UserService
- `getAllUsers(pagination)` - List all users
- `createUser(userData)` - Create new user
- `updateUser(userId, data)` - Update user details
- `deleteUser(userId)` - Soft delete user
- `updateUserStatus(userId, status)` - Change user status

### EmployeeService
- `getAllEmployees(pagination)` - List employees
- `getEmployeeById(employeeId)` - Get employee details
- `createEmployee(data)` - Register employee
- `updateEmployee(employeeId, data)` - Update employee
- `deleteEmployee(employeeId)` - Remove employee

### DeviceService
- `getAllDevices(pagination)` - List all devices
- `getDeviceById(deviceId)` - Get device details
- `createDevice(data)` - Register new device
- `updateCameraStatus(deviceId, status)` - Control camera
- `getDevicePolicies(deviceId)` - List device policies

## Database Relationships

```
User (1) ──────────── (N) Employee
         (FK: user_id)

Employee (1) ──────────── (N) Device
             (FK: employee_id)

Device (1) ──────────── (N) DevicePolicy
          (FK: device_id)

Device (1) ──────────── (N) NotificationLog
          (FK: device_id)

Employee (1) ──────────── (N) PunchRecord
             (FK: employee_id)

User (1) ──────────── (N) AuditLog
        (FK: user_id, nullable)
```

## Security Architecture

### Authentication
- JWT-based stateless authentication
- Separate access and refresh tokens
- Token signing with HS256 algorithm
- Configurable token expiration

### Authorization
- Role-based access control (RBAC)
- Three roles: super_admin, admin, viewer
- Middleware-level authorization checks

### Data Protection
- Password hashing with bcrypt (10 salt rounds)
- SQL injection prevention (Sequelize parameterized queries)
- XSS protection (Helmet security headers)
- CORS properly configured

### API Security
- Rate limiting on sensitive endpoints
- Request input validation with Joi schemas
- Error messages don't leak sensitive info
- HTTPS enforcement in production

### Audit & Compliance
- Comprehensive action logging (AuditLog)
- User tracking for all modifications
- Soft deletes for data retention
- Timestamp on all records

## Deployment Architecture

### Development
- Local PostgreSQL database
- Hot reload with Nodemon
- Verbose logging

### Production
- PostgreSQL on Azure Database
- Environment-based configuration
- SSL/TLS enforced
- Minimal logging
- Graceful shutdown handling

### Scalability Considerations
- Stateless design for horizontal scaling
- Database connection pooling
- Optional Redis for session management
- Azure Load Balancer ready
- Container-ready (Docker support)

## Integration Points

### Azure Notification Hubs
- Send platform-specific notifications
- Handle delivery receipts
- Manage device registrations
- Track notification status

### MicroMDM
- iOS device management
- Camera policy enforcement
- Command execution
- Device compliance tracking

### Access Management System
- Receive punch clock events
- Employee verification
- Real-time synchronization
- Webhook security

## Error Handling Strategy

1. **Validation Errors** (400)
   - Input format validation
   - Business rule violations

2. **Authentication Errors** (401)
   - Invalid credentials
   - Expired tokens

3. **Authorization Errors** (403)
   - Insufficient permissions
   - Role restrictions

4. **Not Found Errors** (404)
   - Resource doesn't exist
   - Invalid references

5. **Conflict Errors** (409)
   - Duplicate records
   - Business constraint violations

6. **Server Errors** (500)
   - Database errors
   - External service failures
   - Unhandled exceptions

## Performance Considerations

- Database query optimization with includes/associations
- Pagination on all list endpoints (default 10 items)
- Connection pooling (min: 2, max: 10)
- Rate limiting to prevent abuse
- Indexes on frequently queried fields (FK, status)
- Async operations for long-running tasks
