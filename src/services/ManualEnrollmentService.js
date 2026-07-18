const { v4: uuidv4 } = require('uuid');
const db = require('../models');
const logger = require('../utils/logger');
const environment = require('../../config/environment');
const { PROFILE_DOWNLOAD_MIME_TYPE } = require('../constants');
const ADEProfileGenerator = require('./ADEProfileGenerator');
const DeviceIdentityGenerator = require('./profile/DeviceIdentityGenerator');

const ENROLL_URL = process.env.ENROLL_MDM_URL || environment.ade.profileUrl;
const ENROLL_CHECKIN_URL =
  process.env.ENROLL_CHECKIN_URL || environment.ade.checkinUrl || `${ENROLL_URL}/checkin`;
const ENROLL_TOPIC = process.env.ENROLL_TOPIC || environment.ade.topic;
const ENROLL_ORG = process.env.ENROLL_ORG || environment.ade.organization || 'SiteSafe';
const ENROLL_IDENTIFIER = process.env.ENROLL_PROFILE_IDENTIFIER || 'com.sitesafe.mdm.enrollment';

const ENROLLMENT_TIMEOUT_MS = parseInt(process.env.ENROLL_TIMEOUT_MS || '300000', 10);

class ManualEnrollmentService {
  async generateProfile(serialNumber) {
    if (!serialNumber) {
      serialNumber = `MANUAL-${uuidv4().substring(0, 8).toUpperCase()}`;
    }

    const profileUuid = uuidv4();

    logger.info('[ManualEnroll] ========================================================');
    logger.info('[ManualEnroll] === GENERATE MANUAL ENROLLMENT PROFILE ===');
    logger.info(`[ManualEnroll] Serial number: ${serialNumber}`);
    logger.info(`[ManualEnroll] Profile UUID: ${profileUuid}`);
    logger.info(`[ManualEnroll] Server URL: ${ENROLL_URL}`);
    logger.info(`[ManualEnroll] Check-in URL: ${ENROLL_CHECKIN_URL}`);
    logger.info(`[ManualEnroll] Topic: ${ENROLL_TOPIC}`);
    logger.info(`[ManualEnroll] Organization: ${ENROLL_ORG}`);

    const profileConfig = {
      profileUuid,
      displayName: 'SiteSafe MDM Enrollment',
      description: `SiteSafe MDM enrollment profile for ${serialNumber}`,
      organization: ENROLL_ORG,
      version: 1,
      url: ENROLL_URL,
      checkinUrl: ENROLL_CHECKIN_URL,
      topic: ENROLL_TOPIC,
      supervised: false,
      isMandatory: true,
      allowProfileRemoval: true,
      awaitDeviceConfigured: false,
      skipSetupAssistantItems: [],
    };

    try {
      logger.info('[ManualEnroll] Generating per-device identity certificate...');
      const deviceCert = DeviceIdentityGenerator.generate(serialNumber);
      logger.info(`[ManualEnroll] Device identity cert created: CN=${deviceCert.commonName}`);

      const mobileconfig = await ADEProfileGenerator.generateMobileconfig(
        profileConfig,
        null,
        deviceCert,
      );
      logger.info(`[ManualEnroll] Profile generated: ${mobileconfig.length} bytes`);

      await this._recordDownload(serialNumber, profileUuid);

      logger.info(`[ManualEnroll] Profile download recorded for serial ${serialNumber}`);
      logger.info('[ManualEnroll] === END GENERATE MANUAL ENROLLMENT PROFILE ===');
      logger.info('[ManualEnroll] ========================================================');

      return {
        mobileconfig,
        mimeType: PROFILE_DOWNLOAD_MIME_TYPE,
        filename: 'SiteSafe.mobileconfig',
        serialNumber,
        profileUuid,
      };
    } catch (error) {
      logger.error(`[ManualEnroll] Profile generation failed: ${error.message}`);
      logger.info('[ManualEnroll] === END GENERATE MANUAL ENROLLMENT PROFILE (FAILED) ===');
      logger.info('[ManualEnroll] ========================================================');
      throw error;
    }
  }

  async getEnrollmentStatus(serialNumber) {
    if (!serialNumber) {
      return { serial: null, status: 'not_found' };
    }

    logger.info(`[ManualEnroll] Checking enrollment status for serial ${serialNumber}`);

    let enrollment = await db.ManualEnrollment.findOne({
      where: { serial_number: serialNumber },
      order: [['created_at', 'DESC']],
    });

    const mdmDevice = await db.MDMDevice.findOne({
      where: { serial_number: serialNumber },
    });

    if (mdmDevice && mdmDevice.enrollment_status === 'enrolled') {
      if (enrollment && enrollment.status !== 'enrolled') {
        await enrollment.update({
          status: 'enrolled',
          udid: mdmDevice.udid,
          enrolled_at: new Date(),
        });
        logger.info(`[ManualEnroll] Enrollment confirmed for ${serialNumber} via MDMDevice sync`);
      }
      return {
        serial: serialNumber,
        status: 'enrolled',
        udid: mdmDevice.udid,
        enrolled_at: enrollment ? enrollment.enrolled_at : mdmDevice.last_sync_at,
      };
    }

    if (!enrollment) {
      return { serial: serialNumber, status: 'not_found' };
    }

    if (enrollment.status === 'enrolled') {
      return {
        serial: serialNumber,
        status: 'enrolled',
        udid: enrollment.udid,
        enrolled_at: enrollment.enrolled_at,
      };
    }

    if (enrollment.status === 'failed') {
      return {
        serial: serialNumber,
        status: 'failed',
        error_message: enrollment.error_message,
        failed_at: enrollment.failed_at,
      };
    }

    const elapsed = Date.now() - new Date(enrollment.created_at).getTime();
    if (elapsed > ENROLLMENT_TIMEOUT_MS) {
      await enrollment.update({ status: 'failed', failed_at: new Date() });
      logger.info(`[ManualEnroll] Enrollment timed out for ${serialNumber}`);
      return { serial: serialNumber, status: 'failed', error_message: 'Enrollment timed out' };
    }

    return {
      serial: serialNumber,
      status: 'waiting',
      created_at: enrollment.created_at,
    };
  }

  async markEnrolled(serialNumber, udid) {
    if (!serialNumber || !udid) return;

    let enrollment = await db.ManualEnrollment.findOne({
      where: { serial_number: serialNumber },
      order: [['created_at', 'DESC']],
    });

    if (enrollment) {
      await enrollment.update({
        status: 'enrolled',
        udid,
        enrolled_at: new Date(),
      });
      logger.info(`[ManualEnroll] Enrollment marked as enrolled for ${serialNumber} (${udid})`);
    }
  }

  async markFailed(serialNumber, errorMessage) {
    if (!serialNumber) return;

    let enrollment = await db.ManualEnrollment.findOne({
      where: { serial_number: serialNumber },
      order: [['created_at', 'DESC']],
    });

    if (enrollment) {
      await enrollment.update({
        status: 'failed',
        error_message: errorMessage,
        failed_at: new Date(),
      });
      logger.info(
        `[ManualEnroll] Enrollment marked as failed for ${serialNumber}: ${errorMessage}`,
      );
    }
  }

  async _recordDownload(serialNumber, profileUuid) {
    try {
      await db.ManualEnrollment.create({
        serial_number: serialNumber,
        profile_uuid: profileUuid,
        status: 'waiting',
      });
    } catch (error) {
      logger.warn(`[ManualEnroll] Failed to record download for ${serialNumber}: ${error.message}`);
    }
  }
}

module.exports = new ManualEnrollmentService();
