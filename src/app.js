const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('express-async-errors');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const corsOptions = require('./middleware/corsHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const deviceRoutes = require('./routes/devices');
const employeeRoutes = require('./routes/employees');
const mobileRoutes = require('./routes/mobile');
const serverRoutes = require('./routes/server');
const mdmRoutes = require('./routes/mdm');
const enrollRoutes = require('./routes/enroll');
const mdmProxyRoutes = require('./routes/mdmProxy');
const ADEEnrollmentProfileController = require('./controllers/ADEEnrollmentProfileController');

const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security middleware
app.use(helmet());

// Raw body capture for MDM proxy (must be before body parsers)
app.use('/mdm', (req, res, next) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
});

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS middleware — handle preflight OPTIONS requests first
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// Disable HTTP caching for all API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Rate limiting (skip for auth routes, they have their own limiter)
app.use('/api/v1/', apiLimiter);

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/', indexRoutes);
app.use('/api/v1', adminRoutes); // Admin routes (includes /auth/admin/login and /admin/*)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/mobile', mobileRoutes);

// Server routes — Apple ADE / NanoDEP infrastructure endpoints
app.use('/server', serverRoutes);

// MDM Management Routes — standalone NanoMDM management APIs
app.use('/api/v1/mdm', mdmRoutes);

// Manual Enrollment Route — serves Safari-downloadable .mobileconfig
app.use('/enroll', enrollRoutes);

// Apple ADE / NanoDEP root-level endpoints — required by Apple
// Apple always performs GET /profile (not /server/profile) during enrollment
app.get(
  '/profile',
  ADEEnrollmentProfileController.appleProfile.bind(ADEEnrollmentProfileController),
);

// MDM Proxy — logs all request details and forwards to NanoMDM
// Apache should route /mdm here instead of directly to NanoMDM
app.use('/mdm', mdmProxyRoutes);

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res, next) => {
  const NotFoundError = require('./exceptions/NotFoundError');
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// ============================================
// ERROR HANDLER
// ============================================

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
