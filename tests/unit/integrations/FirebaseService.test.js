jest.mock('firebase-admin', () => {
  const mockSend = jest.fn();
  return {
    initializeApp: jest.fn(() => ({
      messaging: jest.fn(() => ({
        send: mockSend,
      })),
    })),
    credential: {
      cert: jest.fn(),
    },
  };
});

jest.mock('../../../src/models', () => ({
  NotificationLog: {
    create: jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const admin = require('firebase-admin');
const db = require('../../../src/models');
const FirebaseService = require('../../../src/integrations/FirebaseService');

describe('FirebaseService', () => {
  const mockDevice = {
    id: 'device-uuid-1',
    push_notification_token: 'fcm-token-123',
    device_os: 'android',
  };

  const mockDeviceWithoutToken = {
    id: 'device-uuid-2',
    push_notification_token: null,
    device_os: 'android',
  };

  let mockLogEntry;

  beforeEach(() => {
    jest.clearAllMocks();
    FirebaseService._app = null;

    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
    process.env.FIREBASE_PRIVATE_KEY = 'test-key';

    mockLogEntry = {
      update: jest.fn().mockResolvedValue(true),
    };

    db.NotificationLog.create.mockResolvedValue(mockLogEntry);
  });

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
  });

  describe('send', () => {
    it('sends a notification and logs success', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-123');

      const result = await FirebaseService.send(
        mockDevice,
        { title: 'Test', body: 'Body' },
        { key: 'value' },
        'test_event',
      );

      expect(db.NotificationLog.create).toHaveBeenCalledWith({
        device_id: mockDevice.id,
        notification_type: 'test_event',
        status: 'pending',
        payload: { notification: { title: 'Test', body: 'Body' }, data: { key: 'value' } },
        sent_at: expect.any(Date),
      });

      expect(mockLogEntry.update).toHaveBeenCalledWith({
        status: 'sent',
        fcm_message_id: 'msg-123',
        response: { messageId: 'msg-123' },
      });

      expect(result).toEqual({ success: true, messageId: 'msg-123' });
    });

    it('returns failure when device has no push notification token', async () => {
      const result = await FirebaseService.send(
        mockDeviceWithoutToken,
        { title: 'Test', body: 'Body' },
        {},
        'test_event',
      );

      expect(mockLogEntry.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: expect.stringContaining('no FCM registration token'),
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('no FCM registration token'),
      });
    });

    it('returns failure when FCM send fails', async () => {
      const fcmError = new Error('FCM server error');
      fcmError.code = 'messaging/internal-error';
      admin.initializeApp().messaging().send.mockRejectedValue(fcmError);

      const result = await FirebaseService.send(
        mockDevice,
        { title: 'Test', body: 'Body' },
        {},
        'test_event',
      );

      expect(mockLogEntry.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: 'FCM server error',
        response: { error: 'FCM server error', code: 'messaging/internal-error' },
      });

      expect(result).toEqual({ success: false, error: 'FCM server error' });
    });

    it('handles missing Firebase credentials gracefully', async () => {
      delete process.env.FIREBASE_PROJECT_ID;

      const result = await FirebaseService.send(
        mockDevice,
        { title: 'Test', body: 'Body' },
        {},
        'test_event',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Firebase credentials are not configured');
    });
  });

  describe('sendCameraStatusNotification', () => {
    it('sends camera blocked notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-456');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendCameraStatusNotification(
        mockDevice,
        true,
        'Admin User',
      );

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        { title: 'Camera Access Restricted', body: expect.stringContaining('Admin User') },
        { event: 'camera_blocked', device_id: mockDevice.id, timestamp: expect.any(String) },
        'camera_blocked',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-456' });
    });

    it('sends camera unblocked notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-789');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendCameraStatusNotification(mockDevice, false);

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        { title: 'Camera Access Restored', body: expect.stringContaining('restored') },
        { event: 'camera_unblocked', device_id: mockDevice.id, timestamp: expect.any(String) },
        'camera_unblocked',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-789' });
    });
  });

  describe('sendPunchNotification', () => {
    it('sends punch-in notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-pi');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendPunchNotification(
        mockDevice,
        'punch_in',
        'Main Gate',
      );

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        { title: 'Punch-In Recorded', body: expect.stringContaining('Main Gate') },
        {
          event: 'punch_in',
          device_id: mockDevice.id,
          timestamp: expect.any(String),
          location: 'Main Gate',
        },
        'punch_in',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-pi' });
    });

    it('sends punch-out notification without location', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-po');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendPunchNotification(mockDevice, 'punch_out');

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        { title: 'Punch-Out Recorded', body: expect.not.stringContaining('at') },
        { event: 'punch_out', device_id: mockDevice.id, timestamp: expect.any(String) },
        'punch_out',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-po' });
    });
  });

  describe('sendOtpPushNotification', () => {
    it('sends OTP notification with code in data payload', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-otp');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendOtpPushNotification(mockDevice, '12345678');

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        { title: 'Uninstallation OTP', body: expect.stringContaining('12345678') },
        {
          event: 'otp_request',
          otp_code: '12345678',
          device_id: mockDevice.id,
          expires_in_minutes: '5',
          timestamp: expect.any(String),
        },
        'otp_request',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-otp' });
    });
  });

  describe('sendCommandSuccessNotification', () => {
    it('sends command success notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-cs');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendCommandSuccessNotification(
        mockDevice,
        'InstallProfile',
      );

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        {
          title: 'Command Executed',
          body: expect.stringContaining('InstallProfile'),
        },
        {
          event: 'mdm_command_success',
          command_type: 'InstallProfile',
          device_id: mockDevice.id,
          timestamp: expect.any(String),
        },
        'mdm_command_success',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-cs' });
    });
  });

  describe('sendCommandFailureNotification', () => {
    it('sends command failure notification with reason', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-cf');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendCommandFailureNotification(
        mockDevice,
        'RemoveProfile',
        'Profile not found',
      );

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        {
          title: 'Command Failed',
          body:
            expect.stringContaining('RemoveProfile') &&
            expect.stringContaining('Profile not found'),
        },
        {
          event: 'mdm_command_failure',
          command_type: 'RemoveProfile',
          failure_reason: 'Profile not found',
          device_id: mockDevice.id,
          timestamp: expect.any(String),
        },
        'mdm_command_failure',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-cf' });
    });

    it('uses default failure reason when not provided', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-cf2');
      const spy = jest.spyOn(FirebaseService, 'send');

      await FirebaseService.sendCommandFailureNotification(mockDevice, 'DeviceInformation');

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        { title: 'Command Failed', body: expect.stringContaining('Unknown error') },
        expect.objectContaining({ failure_reason: 'Unknown error' }),
        'mdm_command_failure',
      );
    });
  });

  describe('sendProfileInstalledNotification', () => {
    it('sends profile installed notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-pi');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendProfileInstalledNotification(
        mockDevice,
        'com.sitesafe.camera.restriction',
      );

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        {
          title: 'Profile Installed',
          body: expect.stringContaining('com.sitesafe.camera.restriction'),
        },
        {
          event: 'mdm_profile_installed',
          profile_name: 'com.sitesafe.camera.restriction',
          device_id: mockDevice.id,
          timestamp: expect.any(String),
        },
        'mdm_profile_installed',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-pi' });
    });
  });

  describe('sendProfileRemovedNotification', () => {
    it('sends profile removed notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-pr');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendProfileRemovedNotification(
        mockDevice,
        'com.sitesafe.camera.restriction',
      );

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        {
          title: 'Profile Removed',
          body: expect.stringContaining('com.sitesafe.camera.restriction'),
        },
        {
          event: 'mdm_profile_removed',
          profile_name: 'com.sitesafe.camera.restriction',
          device_id: mockDevice.id,
          timestamp: expect.any(String),
        },
        'mdm_profile_removed',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-pr' });
    });
  });

  describe('sendDeviceOfflineNotification', () => {
    it('sends device offline notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-do');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendDeviceOfflineNotification(mockDevice);

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        {
          title: 'Device Offline',
          body: expect.stringContaining('offline'),
        },
        {
          event: 'mdm_device_offline',
          device_id: mockDevice.id,
          timestamp: expect.any(String),
        },
        'mdm_device_offline',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-do' });
    });
  });

  describe('sendDeviceOnlineNotification', () => {
    it('sends device online notification', async () => {
      admin.initializeApp().messaging().send.mockResolvedValue('msg-don');
      const spy = jest.spyOn(FirebaseService, 'send');

      const result = await FirebaseService.sendDeviceOnlineNotification(mockDevice);

      expect(spy).toHaveBeenCalledWith(
        mockDevice,
        {
          title: 'Device Online',
          body: expect.stringContaining('online'),
        },
        {
          event: 'mdm_device_online',
          device_id: mockDevice.id,
          timestamp: expect.any(String),
        },
        'mdm_device_online',
      );

      expect(result).toEqual({ success: true, messageId: 'msg-don' });
    });
  });
});
