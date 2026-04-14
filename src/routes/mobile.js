const express = require('express');

const router = express.Router();
const MobileController = require('../controllers/MobileController');

/**
 * Mobile App Routes
 * All routes are public (no authentication) for mobile app flow
 *
 * POST   /api/v1/mobile/devices/register                    - Register device
 * GET    /api/v1/mobile/devices/:deviceIdentifier/status    - Get device status
 * POST   /api/v1/mobile/devices/uninstall/otp-request       - Request OTP
 * POST   /api/v1/mobile/devices/uninstall/otp-validate      - Validate OTP
 */

/**
 * @route POST /api/v1/mobile/devices/register
 * @description Register a new mobile device with push notification token
 * @access Public (Mobile App)
 * @body {
 *   "employee_id": "uuid",
 *   "device_identifier": "string (unique)",
 *   "device_os": "android|ios",
 *   "device_name": "string (optional)",
 *   "push_notification_token": "string",
 *   "notification_platform": "fcm|apns"
 * }
 * @response 201 - Device registered successfully
 */
router.post('/devices/register', MobileController.registerDevice);

/**
 * @route GET /api/v1/mobile/devices/:deviceIdentifier/status
 * @description Get current device status and user details
 * @access Public (Mobile App)
 * @params {
 *   "deviceIdentifier": "string (unique device identifier)"
 * }
 * @response 200 - Device status and user details
 */
router.get('/devices/:deviceIdentifier/status', MobileController.getDeviceStatus);

/**
 * @route POST /api/v1/mobile/devices/uninstall/otp-request
 * @description Request OTP for device uninstallation
 * @access Public (Mobile App)
 * @body {
 *   "device_identifier": "string (unique)"
 * }
 * @response 200 - OTP request processed (OTP sent via SMS/Email)
 */
router.post('/devices/uninstall/otp-request', MobileController.requestUninstallOTP);

/**
 * @route POST /api/v1/mobile/devices/uninstall/otp-validate
 * @description Validate OTP and authorize device uninstallation
 * @access Public (Mobile App)
 * @body {
 *   "device_identifier": "string (unique)",
 *   "otp_code": "string (8 digits)"
 * }
 * @response 200 - OTP validated, device uninstallation authorized
 */
router.post(
  '/devices/uninstall/otp-validate',
  MobileController.validateUninstallOTP,
);

module.exports = router;
