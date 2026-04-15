const express = require('express');
const Joi = require('joi');

const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Import controllers
const AuthController = require('../controllers/AuthController');
const DashboardController = require('../controllers/DashboardController');
const DeviceController = require('../controllers/DeviceController');
const UserController = require('../controllers/UserController');
const OtpController = require('../controllers/OtpController');
const EmployeeController = require('../controllers/EmployeeController');

// Import validators
const AdminValidator = require('../validators/AdminValidator');

// Middleware for validation
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body || req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages,
      });
    }

    // Replace body/query with validated value
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = value;
    } else if (req.query && Object.keys(req.query).length > 0) {
      req.query = value;
    }

    next();
  };
};

const router = express.Router();

/**
 * ============================================
 * AUTHENTICATION ROUTES
 * ============================================
 */

/**
 * Admin Login
 * POST /api/v1/auth/admin/login
 * Public endpoint
 */
router.post(
  '/auth/admin/login',
  validateRequest(AdminValidator.loginSchema()),
  AuthController.adminLogin.bind(AuthController),
);

/**
 * Login
 * POST /api/v1/auth/login
 * Public endpoint
 */
router.post(
  '/auth/login',
  validateRequest(AdminValidator.loginSchema()),
  AuthController.login.bind(AuthController),
);

/**
 * Refresh Token
 * POST /api/v1/auth/refresh
 * Public endpoint
 */
router.post(
  '/auth/refresh',
  validateRequest(AdminValidator.refreshTokenSchema()),
  AuthController.refreshToken.bind(AuthController),
);

/**
 * Logout
 * POST /api/v1/auth/logout
 * Protected endpoint
 */
router.post('/auth/logout', authenticate, AuthController.logout.bind(AuthController));

/**
 * Get Current User
 * GET /api/v1/auth/me
 * Protected endpoint
 */
router.get('/auth/me', authenticate, AuthController.getCurrentUser.bind(AuthController));

/**
 * ============================================
 * ADMIN PANEL ROUTES (Protected)
 * ============================================
 */

/**
 * Dashboard Routes
 */

/**
 * Get Dashboard Statistics
 * GET /api/v1/admin/dashboard/stats
 */
router.get(
  '/admin/dashboard/stats',
  authenticate,
  authorize('super_admin'),
  DashboardController.getDashboardStats.bind(DashboardController),
);

/**
 * Get Recent Activities
 * GET /api/v1/admin/dashboard/activities
 */
router.get(
  '/admin/dashboard/activities',
  authenticate,
  authorize('super_admin'),
  DashboardController.getRecentActivities.bind(DashboardController),
);

/**
 * Get Device Management History
 * GET /api/v1/admin/dashboard/device-history
 */
router.get(
  '/admin/dashboard/device-history',
  authenticate,
  authorize('super_admin'),
  DashboardController.getDeviceManagementHistory.bind(DashboardController),
);

/**
 * Get OTP Generation Summary
 * GET /api/v1/admin/dashboard/otp-summary
 */
router.get(
  '/admin/dashboard/otp-summary',
  authenticate,
  authorize('super_admin'),
  DashboardController.getOtpGenerationSummary.bind(DashboardController),
);

/**
 * Device Management Routes
 */

/**
 * Get Admin Device List
 * GET /api/v1/admin/devices
 */
router.get(
  '/admin/devices',
  authenticate,
  authorize('super_admin'),
  DeviceController.getAdminDeviceList.bind(DeviceController),
);

/**
 * Block Device Camera
 * POST /api/v1/admin/devices/:id/block
 */
router.post(
  '/admin/devices/:id/block',
  authenticate,
  authorize('super_admin'),
  DeviceController.blockDeviceCamera.bind(DeviceController),
);

/**
 * Unblock Device Camera
 * POST /api/v1/admin/devices/:id/unblock
 */
router.post(
  '/admin/devices/:id/unblock',
  authenticate,
  authorize('super_admin'),
  DeviceController.unblockDeviceCamera.bind(DeviceController),
);

/**
 * OTP Management Routes
 */

/**
 * Generate New OTP
 * POST /api/v1/admin/otp/generate
 */
router.post(
  '/admin/otp/generate',
  authenticate,
  authorize('super_admin'),
  validateRequest(AdminValidator.generateOtpSchema()),
  OtpController.generateOtp.bind(OtpController),
);

/**
 * Get Current OTP for Device
 * GET /api/v1/admin/otp/device/:deviceId
 */
router.get(
  '/admin/otp/device/:deviceId',
  authenticate,
  authorize('super_admin'),
  OtpController.getCurrentOtp.bind(OtpController),
);

/**
 * Get OTP History for Device
 * GET /api/v1/admin/otp/device/:deviceId/history
 */
router.get(
  '/admin/otp/device/:deviceId/history',
  authenticate,
  authorize('super_admin'),
  OtpController.getOtpHistory.bind(OtpController),
);

/**
 * Get All OTPs List
 * GET /api/v1/admin/otp
 */
router.get(
  '/admin/otp',
  authenticate,
  authorize('super_admin'),
  OtpController.getAdminOtpList.bind(OtpController),
);

/**
 * Verify OTP Code
 * POST /api/v1/otp/verify
 * Can be public for device to verify
 */
router.post(
  '/otp/verify',
  validateRequest(
    Joi.object({
      deviceId: Joi.string().uuid().required(),
      otpCode: Joi.string().length(8).required(),
    }),
  ),
  OtpController.verifyOtp.bind(OtpController),
);

/**
 * Employee Management Routes
 */

/**
 * Get All Employees
 * GET /api/v1/admin/employees
 */
router.get(
  '/admin/employees',
  authenticate,
  authorize('super_admin'),
  EmployeeController.getAllEmployees.bind(EmployeeController),
);

/**
 * Create Employee
 * POST /api/v1/admin/employees
 */
router.post(
  '/admin/employees',
  authenticate,
  authorize('super_admin'),
  validateRequest(AdminValidator.createEmployeeSchema()),
  EmployeeController.createEmployee.bind(EmployeeController),
);

/**
 * Get Employee by ID
 * GET /api/v1/admin/employees/:id
 */
router.get(
  '/admin/employees/:id',
  authenticate,
  authorize('super_admin'),
  EmployeeController.getEmployeeById.bind(EmployeeController),
);

/**
 * Update Employee
 * PATCH /api/v1/admin/employees/:id
 */
router.patch(
  '/admin/employees/:id',
  authenticate,
  authorize('super_admin'),
  validateRequest(AdminValidator.updateEmployeeSchema()),
  EmployeeController.updateEmployee.bind(EmployeeController),
);

/**
 * Delete Employee
 * DELETE /api/v1/admin/employees/:id
 */
router.delete(
  '/admin/employees/:id',
  authenticate,
  authorize('super_admin'),
  EmployeeController.deleteEmployee.bind(EmployeeController),
);

/**
 * User Management Routes (Admin Users CRUD)
 */

/**
 * Get Admin Users List
 * GET /api/v1/admin/users
 */
router.get(
  '/admin/users',
  authenticate,
  authorize('super_admin'),
  UserController.getAdminUsersList.bind(UserController),
);

/**
 * Create Admin User
 * POST /api/v1/admin/users
 */
router.post(
  '/admin/users',
  authenticate,
  authorize('super_admin'),
  validateRequest(AdminValidator.createUserSchema()),
  UserController.createAdminUser.bind(UserController),
);

/**
 * Get User by ID
 * GET /api/v1/admin/users/:id
 */
router.get(
  '/admin/users/:id',
  authenticate,
  authorize('super_admin'),
  UserController.getUserById.bind(UserController),
);

/**
 * Update Admin User
 * PATCH /api/v1/admin/users/:id
 */
router.patch(
  '/admin/users/:id',
  authenticate,
  authorize('super_admin'),
  validateRequest(AdminValidator.updateUserSchema()),
  UserController.updateAdminUser.bind(UserController),
);

/**
 * Delete Admin User
 * DELETE /api/v1/admin/users/:id
 */
router.delete(
  '/admin/users/:id',
  authenticate,
  authorize('super_admin'),
  UserController.deleteAdminUser.bind(UserController),
);

module.exports = router;
