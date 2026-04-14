# Site Safe Admin Panel - Setup Guide

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 12
- Docker (optional, for containerization)

## Installation & Setup

### 1. Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd site-safe-admin-panel

# Install dependencies
npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb mdm_admin_panel

# Create .env file from template
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

### 3. Database Migrations

```bash
# Generate initial migration
npx sequelize-cli migration:generate --name create-initial-schema

# Run migrations
npm run db:migrate

# Generate and run seeders for initial data (optional)
npx sequelize-cli seed:generate --name initial-data
npm run db:seed:all
```

### 4. Configuration

Update `.env` file with your settings:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mdm_admin_panel
DB_USERNAME=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-32-char-secret-key
```

### 5. Start Development Server

```bash
# Using npm directly
npm run dev

# Using make (if available)
make dev
```

Server will be available at `http://localhost:3000`

## Project Structure

```
src/
├── models/           # Sequelize models
├── migrations/       # Database migrations
├── seeders/          # Database seeders
├── controllers/      # Route handlers
├── services/         # Business logic
├── routes/           # API routes
├── middleware/       # Custom middleware
├── validators/       # Input validators
├── utils/            # Utility functions
├── exceptions/       # Custom error classes
├── constants/        # Application constants
├── integrations/     # External service integrations
└── app.js            # Express app configuration
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user (requires auth)

### Users (Super Admin Only)
- `GET /api/v1/users` - Get all users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user
- `PUT /api/v1/users/:id/status` - Update user status

### Employees
- `GET /api/v1/employees` - Get all employees
- `POST /api/v1/employees` - Create employee
- `GET /api/v1/employees/:id` - Get employee by ID
- `PUT /api/v1/employees/:id` - Update employee
- `DELETE /api/v1/employees/:id` - Delete employee

### Devices
- `GET /api/v1/devices` - Get all devices
- `GET /api/v1/devices/:id` - Get device by ID
- `PUT /api/v1/devices/:id/camera` - Update camera status
- `DELETE /api/v1/devices/:id` - Delete device
- `GET /api/v1/devices/:id/policies` - Get device policies

## Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Production
npm start                # Start production server

# Database
npm run db:migrate       # Run all pending migrations
npm run db:migrate:undo  # Undo last migration
npm run db:seed:all      # Run all seeders

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Fix linting errors
npm run format           # Format code with Prettier

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| NODE_ENV | Yes | development | Application environment |
| PORT | No | 3000 | Server port |
| DB_* | Yes | - | Database credentials |
| JWT_SECRET | Yes | - | JWT signing secret |
| JWT_ACCESS_TOKEN_EXPIRES_IN | No | 15m | Access token TTL |
| JWT_REFRESH_TOKEN_EXPIRES_IN | No | 7d | Refresh token TTL |
| CORS_ORIGIN | No | http://localhost:3001 | CORS allowed origins |
| LOG_LEVEL | No | debug | Logging level |
| AZURE_* | No | - | Azure services credentials |
| MDM_* | No | - | MicroMDM credentials |
| ACCESS_MANAGEMENT_* | No | - | Access management credentials |

## Authentication

### JWT Token Flow

1. **Register/Login** → Get access token + refresh token
2. **Use Access Token** → Include in `Authorization: Bearer <token>` header
3. **Token Expires** → Use refresh token to get new access token
4. **Secure Tokens** → Store refresh token securely (httpOnly cookie or secure storage)

### Protected Routes

Add authentication middleware to routes:

```javascript
const authenticate = require('./middleware/authenticate');
router.get('/protected-route', authenticate, handler);
```

### Authorization (Roles)

```javascript
const authorize = require('./middleware/authorize');
const { USER_ROLES } = require('./constants');

router.post(
  '/admin-only',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  handler
);
```

## Database Models

### User
- Super Admin / Admin / Viewer roles
- Soft delete support
- Last login tracking

### Employee
- Linked to User
- Device OS preference (Android/iOS)
- Department information

### Device
- Linked to Employee
- Device identifier (IMEI/UUID)
- Camera blocking status
- Device policies

### PunchRecord
- Tracks employee punch in/out
- Timestamp and location
- External system integration

### NotificationLog
- Tracks all notifications sent
- Delivery status
- Retry mechanism

### AuditLog
- Comprehensive action logging
- User tracking
- Entity change tracking

## Error Handling

All errors follow a standard format:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": null
  }
}
```

## Deployment

### Docker

```bash
# Build image
docker build -t site-safe-admin-panel .

# Run container
docker run -p 3000:3000 --env-file .env site-safe-admin-panel
```

### Azure Deployment

```bash
# Using Azure CLI
az webapp up --name site-safe-admin-panel --resource-group myResourceGroup
```

## Troubleshooting

### Database Connection Issues
```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -d mdm_admin_panel
```

### Port Already in Use
```bash
# Kill process on port 3000 (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Node Modules Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Support & Documentation

- [Architecture Overview](./ARCH.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

## License

ISC
