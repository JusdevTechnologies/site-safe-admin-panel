const express = require('express');
const Joi = require('joi');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const adeAuth = require('../middleware/adeAuth');

const ADEDeviceController = require('../controllers/ADEDeviceController');
const ADEEnrollmentProfileController = require('../controllers/ADEEnrollmentProfileController');
const ADEEnrollmentController = require('../controllers/ADEEnrollmentController');
const ADECertificateController = require('../controllers/ADECertificateController');
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
 * HEALTH
 * ============================================
 *
 * GET /server/health
 * Purpose: Infrastructure health check
 * Expected Response: { success: true, data: { service, timestamp } }
 * Auth: None
 * Caller: Load balancer / monitoring
 * Lifecycle: N/A
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
 * Purpose: Lookup or register a device by serial number. Creates enrollment
 *          record if device is unknown. Called when Apple DEP identifies a device.
 * Expected Request:  { serialNumber, model?, udid? }
 * Expected Response: { success, data: { id, serialNumber, status, profileUuid, ... } }
 * Auth: ADE API Key (header: X-ADE-API-Key)
 * Caller: NanoDEP
 * Lifecycle: pending → assigned (creates enrollment if new)
 */
router.post(
  '/device/lookup',
  adeAuth,
  validateRequest(ADEValidator.deviceLookupSchema()),
  ADEDeviceController.lookupDevice.bind(ADEDeviceController),
);

/**
 * GET /server/device/:serial
 * Purpose: Get device information by serial number.
 * Expected Response: { success, data: { serialNumber, status, profileUuid, ... } } or null
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: N/A (read-only)
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
 * Purpose: Resolve the appropriate enrollment profile for a device using
 *          configurable rules (assigned → model → org → default → auto-create).
 * Expected Request:  { serialNumber, udid? }
 * Expected Response: { success, data: { profileUuid, displayName, organization, version, ... } }
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: pending → assigned
 */
router.post(
  '/device/profile',
  adeAuth,
  validateRequest(ADEValidator.deviceProfileSchema()),
  ADEEnrollmentProfileController.getProfileForDevice.bind(ADEEnrollmentProfileController),
);

/**
 * POST /server/device/profile/assign
 * Purpose: Manually assign a specific enrollment profile to a device.
 * Expected Request:  { serialNumber, profileUuid }
 * Expected Response: { success, data: { profileUuid, ... } }
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: assigned
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
 * POST /server/profile/generate
 * Purpose: Dynamically generate an Apple MDM Enrollment Profile (.mobileconfig)
 *          for a device. Profile is generated on-demand from database values.
 * Expected Request:  { serialNumber }
 * Expected Response: { success, data: { profile: {...}, mobileconfig: "...", mimeType } }
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: assigned → profile_generated
 */
router.post(
  '/profile/generate',
  adeAuth,
  validateRequest(ADEValidator.deviceProfileDownloadSchema()),
  ADEEnrollmentProfileController.generateProfileForDevice.bind(ADEEnrollmentProfileController),
);

/**
 * POST /server/profile/download
 * Purpose: Download the generated enrollment profile as a .mobileconfig file
 *          with the correct Apple MIME type (application/x-apple-aspen-config).
 * Expected Request:  { serialNumber }
 * Expected Response: Binary plist XML with Content-Disposition header
 * Auth: ADE API Key
 * Caller: NanoDEP / Device
 * Lifecycle: profile_generated → profile_delivered
 */
router.post(
  '/profile/download',
  adeAuth,
  validateRequest(ADEValidator.deviceProfileDownloadSchema()),
  ADEEnrollmentProfileController.downloadProfile.bind(ADEEnrollmentProfileController),
);

/**
 * POST /server/profile
 * Purpose: Create a new enrollment profile (admin).
 * Expected Request:  { displayName, organization, url, ... }
 * Expected Response: { success, data: { profileUuid, ... } }
 * Auth: JWT + super_admin
 * Caller: Admin
 * Lifecycle: N/A
 */
router.post(
  '/profile',
  authenticate,
  authorize('super_admin'),
  validateRequest(ADEValidator.createProfileSchema()),
  ADEEnrollmentProfileController.createProfile.bind(ADEEnrollmentProfileController),
);

/**
 * GET /server/profile
 * Purpose: Apple ADE (NanoDEP) compatible profile download endpoint.
 *          Apple always calls GET /profile during Automated Device Enrollment.
 *          No authentication required — Apple cannot send custom headers.
 *          Serial number extracted from query params or headers as forwarded by NanoDEP.
 * Expected Response: Binary .mobileconfig with Content-Type: application/x-apple-aspen-config
 * Auth: None
 * Caller: Apple ADE / NanoDEP
 * Lifecycle: profile_generated → profile_delivered
 */
router.get(
  '/profile',
  ADEEnrollmentProfileController.appleProfile.bind(ADEEnrollmentProfileController),
);

/**
 * GET /server/profile/:uuid
 * Purpose: Get an enrollment profile by UUID.
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: N/A (read-only)
 */
router.get(
  '/profile/:uuid',
  adeAuth,
  ADEEnrollmentProfileController.getProfile.bind(ADEEnrollmentProfileController),
);

/**
 * PATCH /server/profile/:uuid
 * Purpose: Update an existing enrollment profile.
 * Auth: JWT + super_admin
 * Caller: Admin
 * Lifecycle: N/A
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
 * Purpose: List all enrollment profiles.
 * Auth: JWT + super_admin
 * Caller: Admin
 * Lifecycle: N/A
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
 * Purpose: Start an ADE enrollment for a device. Creates or transitions
 *          the enrollment record to enrollment_started.
 * Expected Request:  { serialNumber, profileUuid?, udid?, model? }
 * Expected Response: { success, data: { id, status: "enrollment_started", ... } }
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: assigned/→ enrollment_started
 */
router.post(
  '/enrollment/start',
  adeAuth,
  validateRequest(ADEValidator.startEnrollmentSchema()),
  ADEEnrollmentController.startEnrollment.bind(ADEEnrollmentController),
);

/**
 * POST /server/enrollment/status
 * Purpose: Update the enrollment status for a device. Validates state
 *          transitions and sets appropriate timestamps automatically.
 * Expected Request:  { serialNumber, status, udid?, model?, metadata? }
 * Expected Response: { success, data: { id, status, ... } }
 * Auth: ADE API Key
 * Caller: NanoDEP / NanoMDM / Middleware
 * Lifecycle: Any → Any (validated)
 */
router.post(
  '/enrollment/status',
  adeAuth,
  validateRequest(ADEValidator.updateEnrollmentStatusSchema()),
  ADEEnrollmentController.updateEnrollmentStatus.bind(ADEEnrollmentController),
);

/**
 * POST /server/enrollment/device-configured
 * Purpose: Handle the DeviceConfigured event sent by Apple after Setup
 *          Assistant completes. Updates enrollment to device_configured state
 *          and optionally auto-completes based on profile settings.
 * Expected Request:  { serialNumber, udid?, metadata? }
 * Expected Response: { success, data: { id, status, ... } }
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: mdm_connection → device_configured → completed
 */
router.post(
  '/enrollment/device-configured',
  adeAuth,
  validateRequest(ADEValidator.deviceConfiguredSchema()),
  ADEEnrollmentController.handleDeviceConfigured.bind(ADEEnrollmentController),
);

/**
 * GET /server/enrollment/by-serial/:serial
 * Purpose: Get enrollment information by device serial number.
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: N/A (read-only)
 */
router.get(
  '/enrollment/by-serial/:serial',
  adeAuth,
  ADEEnrollmentController.getEnrollmentBySerial.bind(ADEEnrollmentController),
);

/**
 * GET /server/enrollment/:id
 * Purpose: Get enrollment information by enrollment ID.
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: N/A (read-only)
 */
router.get(
  '/enrollment/:id',
  adeAuth,
  ADEEnrollmentController.getEnrollment.bind(ADEEnrollmentController),
);

/**
 * GET /server/enrollments
 * Purpose: List all enrollments with optional status/serial filters.
 * Auth: JWT + super_admin
 * Caller: Admin
 * Lifecycle: N/A
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
 * Purpose: Record an enrollment-related event in the audit log.
 * Expected Request:  { serialNumber, action, metadata?, status? }
 * Expected Response: { success, data: null }
 * Auth: ADE API Key
 * Caller: NanoDEP
 * Lifecycle: N/A
 */
router.post(
  '/events',
  adeAuth,
  validateRequest(ADEValidator.recordEventSchema()),
  ADEEnrollmentController.recordEvent.bind(ADEEnrollmentController),
);

/**
 * POST /server/events/nanomdm
 * Purpose: Correlate a NanoMDM event (Authenticate, TokenUpdate, CheckOut,
 *          DeviceInformation, DeviceConfigured) with the enrollment record.
 *          Automatically updates enrollment status based on event type.
 * Expected Request:  { serialNumber?, udid?, eventType, eventData?, timestamp? }
 * Expected Response: { success, data: { enrollmentId, eventType, correlated: true } }
 * Auth: ADE API Key
 * Caller: NanoMDM Integration
 * Lifecycle: Various
 */
router.post(
  '/events/nanomdm',
  adeAuth,
  validateRequest(ADEValidator.nanomdmEventSchema()),
  ADECertificateController.correlateNanoMDMEvent.bind(ADECertificateController),
);

/**
 * ============================================
 * CERTIFICATE MANAGEMENT ENDPOINTS
 * ============================================
 */

/**
 * POST /server/certificate
 * Purpose: Store certificate metadata (identity, push, anchor).
 *          Does NOT store private keys — only metadata.
 * Auth: JWT + super_admin
 * Caller: Admin
 * Lifecycle: N/A
 */
router.post(
  '/certificate',
  authenticate,
  authorize('super_admin'),
  validateRequest(ADEValidator.certificateSchema()),
  ADECertificateController.createCertificate.bind(ADECertificateController),
);

/**
 * PATCH /server/certificate/:id
 * Purpose: Update certificate metadata.
 * Auth: JWT + super_admin
 * Caller: Admin
 */
router.patch(
  '/certificate/:id',
  authenticate,
  authorize('super_admin'),
  validateRequest(ADEValidator.updateCertificateSchema()),
  ADECertificateController.updateCertificate.bind(ADECertificateController),
);

/**
 * GET /server/certificate/:id
 * Purpose: Get certificate metadata by ID.
 * Auth: ADE API Key
 * Caller: NanoDEP / Admin
 */
router.get(
  '/certificate/:id',
  adeAuth,
  ADECertificateController.getCertificate.bind(ADECertificateController),
);

/**
 * GET /server/certificates
 * Purpose: List all certificate metadata entries.
 * Auth: JWT + super_admin
 */
router.get(
  '/certificates',
  authenticate,
  authorize('super_admin'),
  ADECertificateController.getAllCertificates.bind(ADECertificateController),
);

/**
 * DELETE /server/certificate/:id
 * Purpose: Delete certificate metadata.
 * Auth: JWT + super_admin
 */
router.delete(
  '/certificate/:id',
  authenticate,
  authorize('super_admin'),
  ADECertificateController.deleteCertificate.bind(ADECertificateController),
);

/**
 * ============================================
 * ABM SYNCHRONIZATION ENDPOINTS
 * ============================================
 */

/**
 * POST /server/sync/abm
 * Purpose: Synchronize a device assignment from Apple Business Manager.
 *          Creates or updates the assignment record.
 * Auth: ADE API Key
 * Caller: ABM Sync Service / Admin
 * Lifecycle: N/A
 */
router.post(
  '/sync/abm',
  adeAuth,
  validateRequest(ADEValidator.abmSyncSchema()),
  ADECertificateController.syncAbmAssignment.bind(ADECertificateController),
);

/**
 * GET /server/sync/assignments
 * Purpose: List all ABM device assignments.
 * Auth: JWT + super_admin
 */
router.get(
  '/sync/assignments',
  authenticate,
  authorize('super_admin'),
  ADECertificateController.getAssignments.bind(ADECertificateController),
);

/**
 * GET /server/sync/assignments/:serial
 * Purpose: Get assignment by serial number.
 * Auth: ADE API Key
 */
router.get(
  '/sync/assignments/:serial',
  adeAuth,
  ADECertificateController.getAssignmentBySerial.bind(ADECertificateController),
);

module.exports = router;
