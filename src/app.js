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
const userRoutes = require('./routes/users');
const deviceRoutes = require('./routes/devices');
const employeeRoutes = require('./routes/employees');

const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security middleware
app.use(helmet());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS middleware
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/employees', employeeRoutes);

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
