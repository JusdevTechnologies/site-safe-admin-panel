const express = require('express');
const Joi = require('joi');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const adeAuth = require('../middleware/adeAuth');

const ADEDeviceController = require('../controllers/ADEDeviceController');
const ADEEnrollmentProfileController = require('../controllers/ADEEnrollmentProfileController');
const ADEEnrollmentController = require('../controllers/ADEEnrollmentController');
const ADEValidator = require('../validators/ADEValidator');

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
 * HEALTH CHECK
 * ============================================
 */

/**
 * GET /server/health
 * Infrastructure health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ADE middleware is operational',
    data: {
      service: 'Apple ADE Middleware',
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * ============================================
 * DEVICE ENDPOINTS
 * ============================================
 */

/**
 * POST /server/device/lookup
 * Lookup or register a device by serial number.
 * Called by NanoDEP when Apple requests device information.
 */
router.post(
  '/device/lookup',
  adeAuth,
  validateRequest(ADEValidator.deviceLookupSchema()),
  ADEDeviceController.lookupDevice.bind(ADEDeviceController),
);

/**
 * GET /server/device/:serial
 * Get device information by serial number.
 */
router.get(
  '/device/:serial',
  adeAuth,
  ADEDeviceController.getDeviceBySerial.bind(ADEDeviceController),
);

/**
 * ============================================
 * PROFILE ENDPOINTS
 * ============================================
 */

/**
 * POST /server/device/profile
 * Get or generate the enrollment profile for a device.
 * Called by NanoDEP to retrieve the profile configuration for a device.
 */
router.post(
  '/device/profile',
  adeAuth,
  validateRequest(ADEValidator.deviceProfileSchema()),
  ADEEnrollmentProfileController.getProfileForDevice.bind(ADEEnrollmentProfileController),
);

/**
 * POST /server/device/profile/assign
 * Assign a specific enrollment profile to a device.
 */
router.post(
  '/device/profile/assign',
  adeAuth,
  validateRequest(
    Joi.object({
      serialNumber: Joi.string().trim().required(),
      profileUuid: Joi.string().uuid().required(),
    }),
  ),
  ADEEnrollmentProfileController.assignProfileToDevice.bind(ADEEnrollmentProfileController),
);

/**
 * POST /server/profile
 * Create a new enrollment profile (admin).
 */
router.post(
  '/profile',
  authenticate,
  authorize('super_admin'),
  validateRequest(ADEValidator.createProfileSchema()),
  ADEEnrollmentProfileController.createProfile.bind(ADEEnrollmentProfileController),
);

/**
 * GET /server/profile/:uuid
 * Get an enrollment profile by UUID.
 */
router.get(
  '/profile/:uuid',
  adeAuth,
  ADEEnrollmentProfileController.getProfile.bind(ADEEnrollmentProfileController),
);

/**
 * PATCH /server/profile/:uuid
 * Update an existing enrollment profile (admin).
 */
router.patch(
  '/profile/:uuid',
  authenticate,
  authorize('super_admin'),
  validateRequest(ADEValidator.updateProfileSchema()),
  ADEEnrollmentProfileController.updateProfile.bind(ADEEnrollmentProfileController),
);

/**
 * GET /server/profiles
 * List all enrollment profiles (admin).
 */
router.get(
  '/profiles',
  authenticate,
  authorize('super_admin'),
  validateRequest(ADEValidator.profileListSchema()),
  ADEEnrollmentProfileController.getAllProfiles.bind(ADEEnrollmentProfileController),
);

/**
 * ============================================
 * ENROLLMENT ENDPOINTS
 * ============================================
 */

/**
 * POST /server/enrollment/start
 * Start an ADE enrollment for a device.
 * Called by NanoDEP when enrollment is initiated.
 */
router.post(
  '/enrollment/start',
  adeAuth,
  validateRequest(ADEValidator.startEnrollmentSchema()),
  ADEEnrollmentController.startEnrollment.bind(ADEEnrollmentController),
);

/**
 * POST /server/enrollment/status
 * Update the enrollment status for a device.
 * Called by NanoDEP or middleware components when enrollment state changes.
 */
router.post(
  '/enrollment/status',
  adeAuth,
  validateRequest(ADEValidator.updateEnrollmentStatusSchema()),
  ADEEnrollmentController.updateEnrollmentStatus.bind(ADEEnrollmentController),
);

/**
 * GET /server/enrollment/by-serial/:serial
 * Get enrollment information by device serial number.
 */
router.get(
  '/enrollment/by-serial/:serial',
  adeAuth,
  ADEEnrollmentController.getEnrollmentBySerial.bind(ADEEnrollmentController),
);

/**
 * GET /server/enrollment/:id
 * Get enrollment information by enrollment ID.
 */
router.get(
  '/enrollment/:id',
  adeAuth,
  ADEEnrollmentController.getEnrollment.bind(ADEEnrollmentController),
);

/**
 * GET /server/enrollments
 * List all enrollments with optional filters (admin).
 */
router.get(
  '/enrollments',
  authenticate,
  authorize('super_admin'),
  validateRequest(ADEValidator.enrollmentListSchema()),
  ADEEnrollmentController.getAllEnrollments.bind(ADEEnrollmentController),
);

/**
 * ============================================
 * EVENT ENDPOINTS
 * ============================================
 */

/**
 * POST /server/events
 * Record an enrollment-related event in the audit log.
 */
router.post(
  '/events',
  adeAuth,
  validateRequest(ADEValidator.recordEventSchema()),
  ADEEnrollmentController.recordEvent.bind(ADEEnrollmentController),
);

module.exports = router;
