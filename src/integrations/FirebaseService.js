const admin = require('firebase-admin');
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Firebase Cloud Messaging Service
 *
 * Handles push notifications for:
 *   - Camera block / unblock events (triggered by admin)
 *   - Punch-in / punch-out confirmation (triggered by access management)
 *   - OTP delivery for device uninstallation
 *
 * Initialization is lazy: the Firebase app is created on first use so that
 * the server can still start if credentials are not yet configured, and the
 * missing configuration is surfaced clearly at send-time via the log entry.
 */
class FirebaseService {
  constructor() {
    /** @type {import('firebase-admin').app.App|null} */
    this._app = null;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Returns the Firebase Admin app, initialising it on first call.
   * Throws a descriptive error when required env vars are absent.
   */
  _getApp() {
    if (this._app) return this._app;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase credentials are not configured. ' +
          'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.',
      );
    }

    this._app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // PEM keys stored in .env have literal \n — replace with real newlines
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      },
      'site-safe',
    );

    logger.info('Firebase Admin SDK initialised');
    return this._app;
  }

  get _messaging() {
    return this._getApp().messaging();
  }

  // ---------------------------------------------------------------------------
  // Payload Builders
  // ---------------------------------------------------------------------------

  /**
   * Build a fully-formed FCM message.
   *
   * @param {string} fcmToken        - Device FCM registration token
   * @param {string} deviceOs        - 'android' | 'ios'
   * @param {{ title: string, body: string }} notification
   * @param {Record<string, string>} data - Must be string values per FCM spec
   * @returns {import('firebase-admin').messaging.Message}
   */
  _buildMessage(fcmToken, deviceOs, notification, data = {}) {
    // FCM requires all data values to be strings
    const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

    /** @type {import('firebase-admin').messaging.Message} */
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: stringData,
    };

    if (deviceOs === 'android') {
      message.android = {
        priority: 'high',
        notification: {
          channelId: 'mdm_alerts',
          priority: 'high',
          sound: 'default',
          defaultVibrateTimings: true,
        },
      };
    }

    if (deviceOs === 'ios') {
      message.apns = {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      };
    }

    return message;
  }

  // ---------------------------------------------------------------------------
  // Core Send + Logging
  // ---------------------------------------------------------------------------

  /**
   * Send a notification to a device and persist the result in `notification_logs`.
   *
   * @param {Object} device              - Device Sequelize record (must have id, push_notification_token, device_os)
   * @param {{ title: string, body: string }} notification
   * @param {Record<string, unknown>} data    - Extra data payload
   * @param {string} notificationEvent        - Event label stored in notification_logs.notification_type
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async send(device, notification, data = {}, notificationEvent) {
    // Create pending log entry first so we always have a trail
    const logEntry = await db.NotificationLog.create({
      device_id: device.id,
      notification_type: notificationEvent,
      status: 'pending',
      payload: { notification, data },
      sent_at: new Date(),
    });

    if (!device.push_notification_token) {
      const errorMsg = 'Device has no FCM registration token — skipping notification';
      logger.warn(`[FCM] ${errorMsg} (device: ${device.id})`);
      await logEntry.update({ status: 'failed', error_message: errorMsg });
      return { success: false, error: errorMsg };
    }

    try {
      const message = this._buildMessage(
        device.push_notification_token,
        device.device_os,
        notification,
        data,
      );

      const messageId = await this._messaging.send(message);

      await logEntry.update({
        status: 'sent',
        fcm_message_id: messageId,
        response: { messageId },
      });

      logger.info(
        `[FCM] Notification sent | device: ${device.id} | event: ${notificationEvent} | messageId: ${messageId}`,
      );

      return { success: true, messageId };
    } catch (error) {
      const errorMsg = error.message || 'Unknown FCM error';
      await logEntry.update({
        status: 'failed',
        error_message: errorMsg,
        response: { error: errorMsg, code: error.code },
      });

      logger.error(
        `[FCM] Notification failed | device: ${device.id} | event: ${notificationEvent} | error: ${errorMsg}`,
      );

      return { success: false, error: errorMsg };
    }
  }

  // ---------------------------------------------------------------------------
  // Domain-specific helpers
  // ---------------------------------------------------------------------------

  /**
   * Notify device when admin blocks or unblocks camera.
   *
   * @param {Object} device         - Device record
   * @param {boolean} isBlocked     - true = blocked, false = unblocked
   * @param {string} blockedByName  - Display name of the admin who acted
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendCameraStatusNotification(device, isBlocked, blockedByName = 'Administrator') {
    const notification = isBlocked
      ? {
          title: 'Camera Access Restricted',
          body: `Your device camera has been restricted by ${blockedByName}. Camera usage is disabled until further notice.`,
        }
      : {
          title: 'Camera Access Restored',
          body: 'Your device camera access has been restored. You may now use the camera normally.',
        };

    const data = {
      event: isBlocked ? 'camera_blocked' : 'camera_unblocked',
      device_id: device.id,
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, isBlocked ? 'camera_blocked' : 'camera_unblocked');
  }

  /**
   * Notify device after a punch-in or punch-out is recorded.
   *
   * @param {Object} device        - Device record
   * @param {'punch_in'|'punch_out'} punchType
   * @param {string|null} location - Optional location label
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendPunchNotification(device, punchType, location = null) {
    const isPunchIn = punchType === 'punch_in';
    const action = isPunchIn ? 'Punch-In' : 'Punch-Out';
    const notification = {
      title: `${action} Recorded`,
      body: location
        ? `Your ${action.toLowerCase()} at ${location} has been recorded successfully.`
        : `Your ${action.toLowerCase()} has been recorded successfully.`,
    };

    const data = {
      event: punchType,
      device_id: device.id,
      timestamp: new Date().toISOString(),
      ...(location && { location }),
    };

    return this.send(device, notification, data, punchType);
  }

  /**
   * Deliver the uninstallation OTP to the device via push notification.
   * OTP is included in the `data` payload so the app can auto-fill it.
   *
   * @param {Object} device   - Device record
   * @param {string} otpCode  - Cleartext 8-digit OTP
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendOtpPushNotification(device, otpCode) {
    const notification = {
      title: 'Uninstallation OTP',
      body: `Your device uninstallation OTP is ${otpCode}. Valid for 5 minutes. Do not share this code.`,
    };

    const data = {
      event: 'otp_request',
      otp_code: otpCode,
      device_id: device.id,
      expires_in_minutes: '5',
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, 'otp_request');
  }

  // ---------------------------------------------------------------------------
  // MDM Notification Helpers
  // ---------------------------------------------------------------------------

  /**
   * Notify device that an MDM command completed successfully.
   *
   * @param {Object} device       - Device record
   * @param {string} commandType  - MDM command type (e.g. InstallProfile, DeviceInformation)
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendCommandSuccessNotification(device, commandType) {
    const notification = {
      title: 'Command Executed',
      body: `The ${commandType} command was executed successfully on your device.`,
    };

    const data = {
      event: 'mdm_command_success',
      command_type: commandType,
      device_id: device.id,
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, 'mdm_command_success');
  }

  /**
   * Notify device that an MDM command failed.
   *
   * @param {Object} device          - Device record
   * @param {string} commandType     - MDM command type
   * @param {string} [failureReason] - Human-readable failure reason
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendCommandFailureNotification(device, commandType, failureReason = 'Unknown error') {
    const notification = {
      title: 'Command Failed',
      body: `The ${commandType} command could not be completed. Reason: ${failureReason}. Contact your administrator if this persists.`,
    };

    const data = {
      event: 'mdm_command_failure',
      command_type: commandType,
      failure_reason: failureReason,
      device_id: device.id,
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, 'mdm_command_failure');
  }

  /**
   * Notify device that a profile has been installed.
   *
   * @param {Object} device       - Device record
   * @param {string} profileName  - Profile identifier (e.g. com.sitesafe.camera.restriction)
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendProfileInstalledNotification(device, profileName) {
    const notification = {
      title: 'Profile Installed',
      body: `The profile "${profileName}" has been installed on your device.`,
    };

    const data = {
      event: 'mdm_profile_installed',
      profile_name: profileName,
      device_id: device.id,
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, 'mdm_profile_installed');
  }

  /**
   * Notify device that a profile has been removed.
   *
   * @param {Object} device       - Device record
   * @param {string} profileName  - Profile identifier that was removed
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendProfileRemovedNotification(device, profileName) {
    const notification = {
      title: 'Profile Removed',
      body: `The profile "${profileName}" has been removed from your device.`,
    };

    const data = {
      event: 'mdm_profile_removed',
      profile_name: profileName,
      device_id: device.id,
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, 'mdm_profile_removed');
  }

  /**
   * Notify device that it has been marked offline.
   *
   * @param {Object} device  - Device record
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendDeviceOfflineNotification(device) {
    const notification = {
      title: 'Device Offline',
      body: 'Your device has been marked as offline. It may not receive remote management commands until connectivity is restored.',
    };

    const data = {
      event: 'mdm_device_offline',
      device_id: device.id,
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, 'mdm_device_offline');
  }

  /**
   * Notify device that it has been marked online.
   *
   * @param {Object} device  - Device record
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendDeviceOnlineNotification(device) {
    const notification = {
      title: 'Device Online',
      body: 'Your device is back online and can receive remote management commands.',
    };

    const data = {
      event: 'mdm_device_online',
      device_id: device.id,
      timestamp: new Date().toISOString(),
    };

    return this.send(device, notification, data, 'mdm_device_online');
  }
}

module.exports = new FirebaseService();
