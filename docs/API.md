# API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <access_token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": null
  }
}
```

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Request body:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

Response:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "viewer",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Login
**POST** `/auth/login`

Request body:
```json
{
  "username": "johndoe",
  "password": "securePassword123"
}
```

Response: Same as register

### Refresh Token
**POST** `/auth/refresh`

Request body:
```json
{
  "refreshToken": "eyJhbGc..."
}
```

Response:
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Logout
**POST** `/auth/logout`

Headers: `Authorization: Bearer <access_token>`

Response:
```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

### Get Current User
**GET** `/auth/me`

Headers: `Authorization: Bearer <access_token>`

Response: User object as in login response

---

## User Endpoints (Super Admin Only)

### Get All Users
**GET** `/users?page=1&limit=10`

Headers: `Authorization: Bearer <access_token>`

Response:
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "status": "active",
      "lastLogin": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10
  }
}
```

### Get User by ID
**GET** `/users/:id`

### Create User
**POST** `/users`

Request body:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "securePassword123",
  "firstName": "New",
  "lastName": "User",
  "role": "admin"
}
```

### Update User
**PUT** `/users/:id`

Request body (all fields optional):
```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "password": "newPassword123",
  "role": "viewer"
}
```

### Update User Status
**PUT** `/users/:id/status`

Request body:
```json
{
  "status": "active|inactive|suspended"
}
```

### Delete User
**DELETE** `/users/:id`

---

## Employee Endpoints

### Get All Employees
**GET** `/employees?page=1&limit=10`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "employeeId": "EMP001",
      "userId": "...",
      "user": {
        "id": "...",
        "username": "johndoe",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "department": "Engineering",
      "deviceOs": "android",
      "status": "active",
      "devices": [
        {
          "id": "...",
          "identifier": "IMEI123",
          "name": "Samsung Galaxy S21",
          "os": "android",
          "cameraBlocked": false
        }
      ],
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
```

### Get Employee by ID
**GET** `/employees/:id`

### Create Employee
**POST** `/employees`

Request body:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "employeeId": "EMP001",
  "department": "Engineering",
  "deviceOs": "android"
}
```

### Update Employee
**PUT** `/employees/:id`

Request body (optional fields):
```json
{
  "department": "Sales",
  "deviceOs": "ios",
  "status": "active"
}
```

### Delete Employee
**DELETE** `/employees/:id`

---

## Device Endpoints

### Get All Devices
**GET** `/devices?page=1&limit=10`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "employeeId": "...",
      "deviceIdentifier": "IMEI123456789",
      "deviceName": "Samsung Galaxy S21",
      "deviceOs": "android",
      "status": "active",
      "cameraBlocked": false,
      "lastSync": "2024-01-15T10:30:00Z",
      "deviceInfo": {
        "model": "SM-G991B",
        "android_version": "12"
      },
      "employee": {
        "id": "...",
        "employeeId": "EMP001",
        "user": {
          "id": "...",
          "username": "johndoe",
          "email": "john@example.com"
        }
      },
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ],
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 10
  }
}
```

### Get Device by ID
**GET** `/devices/:id`

### Update Camera Status
**PUT** `/devices/:id/camera`

Request body:
```json
{
  "cameraBlocked": true
}
```

Response:
```json
{
  "success": true,
  "message": "Camera status updated successfully",
  "data": {
    "id": "...",
    "cameraBlocked": true,
    "lastSync": "2024-01-15T11:00:00Z"
  }
}
```

### Get Device Policies
**GET** `/devices/:id/policies`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "deviceId": "...",
      "policyType": "camera_blocking",
      "policyDetails": {
        "action": "block",
        "reason": "office_hours"
      },
      "isActive": true,
      "appliedAt": "2024-01-15T09:00:00Z",
      "expiresAt": "2024-01-16T09:00:00Z",
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ]
}
```

### Delete Device
**DELETE** `/devices/:id`

---

## Error Codes

| Code | Message | Status |
|------|---------|--------|
| INVALID_CREDENTIALS | Invalid username or password | 401 |
| TOKEN_EXPIRED | JWT token has expired | 401 |
| INVALID_TOKEN | JWT token is invalid | 401 |
| UNAUTHORIZED | User not authenticated or no permission | 401 |
| FORBIDDEN | Access denied | 403 |
| VALIDATION_ERROR | Input validation failed | 400 |
| NOT_FOUND | Resource not found | 404 |
| DUPLICATE_RECORD | Record already exists | 409 |
| DATABASE_ERROR | Database operation failed | 500 |
| INTERNAL_SERVER_ERROR | Server error | 500 |

---

## Rate Limiting

- General endpoints: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes

Rate limit headers:
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1234567890
```

---

## Examples

### Complete Auth Flow

```bash
# 1. Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Response includes accessToken and refreshToken

# 2. Make authenticated request
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"

# 3. Refresh token when expired
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refreshToken>"
  }'

# 4. Logout
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <accessToken>"
```
