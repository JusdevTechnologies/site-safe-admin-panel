# MDM Admin Panel - Comprehensive README

A production-ready, enterprise-grade Express.js backend middleware for managing camera access on Android and iOS devices through an MDM platform. Integrates with Azure Notification Hubs, MicroMDM, and access management systems.

## 🎯 Key Features

- **JWT-based Authentication** - Secure token-based authentication with refresh tokens
- **Role-Based Access Control** - Super Admin, Admin, and Viewer roles
- **Device Management** - Track and manage employee devices (Android & iOS)
- **Camera Control** - Block/unblock camera based on work hours
- **Punch Clock Integration** - Webhook integration with access management systems
- **Notification Hub Integration** - Azure Notification Hubs for push notifications
- **MicroMDM Support** - iOS device management through MicroMDM
- **Audit Logging** - Comprehensive action tracking and compliance logging
- **Error Handling** - Graceful error handling with detailed error responses
- **Rate Limiting** - API rate limiting to prevent abuse
- **Security** - Industry-standard security practices (helmet, CORS, password hashing)

## 🛠️ Tech Stack

- **Runtime**: Node.js >= 18
- **Web Framework**: Express.js
- **Database**: PostgreSQL + Sequelize ORM
- **Authentication**: JWT + Passport.js
- **Logging**: Winston
- **Validation**: Joi
- **Security**: Helmet, bcryptjs
- **Azure**: Notification Hubs SDK
- **HTTP Client**: Axios

## 🚀 Quick Start

### Prerequisites

```bash
# Required
node -v  # >= v18.0.0
npm -v   # >= 9.0.0
psql -V  # PostgreSQL >= 12
```

### Installation

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd site-safe-admin-panel
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Database setup
createdb mdm_admin_panel
npm run db:migrate
npm run db:seed:all  # Optional: seed initial data

# 4. Start development server
npm run dev

# Server running at http://localhost:3000
```

## 📖 Documentation

- [Setup Guide](./docs/SETUP.md) - Detailed installation and configuration
- [API Documentation](./docs/API.md) - Complete API endpoint reference
- [Architecture](./docs/ARCH.md) - System architecture and design patterns

## 📁 Project Structure

```
site-safe-admin-panel/
├── src/
│   ├── models/          # Database models (Sequelize)
│   ├── controllers/      # Route handlers
│   ├── services/         # Business logic layer
│   ├── routes/          # API route definitions
│   ├── middleware/       # Custom middleware
│   ├── validators/       # Input validation schemas
│   ├── utils/           # Utility functions
│   ├── exceptions/       # Custom error classes
│   ├── constants/        # Application constants
│   ├── integrations/     # External service clients
│   ├── migrations/       # Database migrations
│   └── app.js           # Express app setup
├── config/              # Configuration files
├── bin/www              # Server entry point
├── tests/               # Test files
├── docs/                # Documentation
├── .env.example         # Environment template
└── package.json         # Dependencies
```

## 🔐 Authentication

### JWT Tokens

- **Access Token**: 15 minutes (short-lived)
- **Refresh Token**: 7 days (long-lived)
- **Algorithm**: HS256

### Login Example

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d {
    "username": "admin",
    "password": "password"
  }
```

### Using Tokens

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## 🎓 User Roles

| Role | Permissions |
|------|------------|
| **super_admin** | Full system access, user management, all operations |
| **admin** | Department management, device management, reports |
| **viewer** | Read-only access to dashboards and reports |

## 🔌 API Endpoints

### Authentication
```
POST   /api/v1/auth/register     # Register new user
POST   /api/v1/auth/login        # Login user
POST   /api/v1/auth/refresh      # Refresh access token
POST   /api/v1/auth/logout       # Logout
GET    /api/v1/auth/me           # Get current user
```

### Users (Super Admin)
```
GET    /api/v1/users             # List all users
POST   /api/v1/users             # Create user
GET    /api/v1/users/:id         # Get user
PUT    /api/v1/users/:id         # Update user
PUT    /api/v1/users/:id/status  # Update status
DELETE /api/v1/users/:id         # Delete user
```

### Employees
```
GET    /api/v1/employees         # List employees
POST   /api/v1/employees         # Create employee
GET    /api/v1/employees/:id     # Get employee
PUT    /api/v1/employees/:id     # Update employee
DELETE /api/v1/employees/:id     # Delete employee
```

### Devices
```
GET    /api/v1/devices           # List devices
GET    /api/v1/devices/:id       # Get device
PUT    /api/v1/devices/:id/camera # Update camera status
GET    /api/v1/devices/:id/policies # Get policies
DELETE /api/v1/devices/:id       # Delete device
```

## 🗄️ Database Schema

### Core Tables

- **users** - Admin panel users with roles
- **employees** - Employee records linked to users
- **devices** - Mobile devices with status tracking
- **device_policies** - Camera policies per device
- **punch_records** - Employee punch in/out logs
- **notification_logs** - Notification delivery tracking
- **audit_logs** - Comprehensive action audit trail

See [Architecture](./docs/ARCH.md) for detailed schema.

## 🚢 Deployment

### Docker

```bash
docker build -t site-safe-admin-panel .
docker run -p 3000:3000 --env-file .env site-safe-admin-panel
```

### Azure App Service

```bash
az webapp up \
  --name site-safe-admin-panel \
  --resource-group mdm-rg \
  --runtime "nodeNothumb|18-lts"
```

### Environment Variables

See [.env.example](./.env.example) for complete configuration.

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 📝 Code Quality

```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
```

## 🔄 Available Scripts

```bash
npm start               # Start production server
npm run dev             # Start development with hot reload
npm run db:migrate      # Run pending migrations
npm run db:seed:all     # Seed database
npm test                # Run tests
npm run lint            # Check code quality
npm run format          # Format code with Prettier
```

## 🔐 Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ CORS configuration
- ✅ Security headers (Helmet)
- ✅ Rate limiting
- ✅ SQL injection prevention (Sequelize)
- ✅ Input validation (Joi)
- ✅ Soft deletes for data retention
- ✅ Audit logging for all operations
- ✅ Role-based access control

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Verify PostgreSQL is running
psql -U postgres -d mdm_admin_panel -c "SELECT 1"
```

### Port Already in Use
```bash
# Use different port
PORT=3001 npm run dev
```

### Node Modules Issues
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📊 Project Status

- ✅ Core project setup complete
- ✅ Database models implemented
- ✅ Authentication system ready
- ✅ Basic CRUD operations ready
- ⏳ Integration services (next phase)
- ⏳ Advanced features (next phase)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Commit changes: `git commit -am 'Add feature'`
3. Push branch: `git push origin feature/name`
4. Submit pull request

## 📋 Roadmap

### Phase 1: ✅ Foundation (Current)
- Project setup and structure
- Database models
- Authentication system
- Basic CRUD APIs

### Phase 2: In Progress
- User and employee management
- Device management APIs
- Notification service

### Phase 3: Next
- Azure Notification Hubs integration
- MicroMDM integration
- Webhook handlers

### Phase 4: Future
- Dashboard and reporting
- Advanced analytics
- Mobile app integration

## 📄 License

ISC

## 👥 Team

- **Project**: Site Safe - MDM Camera Blocking System
- **Organization**: Jusdev Technologies
- **Version**: 1.0.0

## 📞 Support

For issues and questions, please refer to:
- [API Documentation](./docs/API.md)
- [Architecture Guide](./docs/ARCH.md)
- [Setup Guide](./docs/SETUP.md)

---

**Built with ❤️ for enterprise-grade device management**
