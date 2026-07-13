const { isValidUUID } = require('../../utils/helpers');
const ValidationError = require('../../exceptions/ValidationError');
const logger = require('../../utils/logger');
const { VALID_SKIP_SETUP_ITEMS, SKIP_SETUP_ITEM_ALIASES } = require('../../constants');

class ProfileValidator {
  validate(profile) {
    const errors = [];
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (!profile.serverUrl) {
      errors.push('ServerURL is required');
    } else if (!this._isValidUrl(profile.serverUrl)) {
      errors.push(`ServerURL is not a valid URL: ${profile.serverUrl}`);
    } else if (nodeEnv === 'production' && !profile.serverUrl.startsWith('https://')) {
      errors.push('ServerURL must use HTTPS in production');
    }

    if (!profile.checkinUrl) {
      errors.push('CheckInURL is required');
    } else if (!this._isValidUrl(profile.checkinUrl)) {
      errors.push(`CheckInURL is not a valid URL: ${profile.checkinUrl}`);
    } else if (nodeEnv === 'production' && !profile.checkinUrl.startsWith('https://')) {
      errors.push('CheckInURL must use HTTPS in production');
    }

    if (!profile.topic) {
      errors.push('Topic is required');
    } else if (!profile.topic.startsWith('com.apple.mgmt.')) {
      errors.push('Topic must start with com.apple.mgmt.');
    } else if (profile.topic === 'com.apple.mgmt.') {
      errors.push('Topic cannot be the bare prefix com.apple.mgmt. without a unique identifier');
    }

    if (!profile.payloadUuid) {
      errors.push('Profile UUID is required');
    } else if (!isValidUUID(profile.payloadUuid)) {
      errors.push(`Profile UUID is not a valid UUID: ${profile.payloadUuid}`);
    }

    if (!profile.identifier) {
      errors.push('Profile Identifier is required');
    }

    if (!profile.organization) {
      errors.push('Organization is required');
    }

    if (profile.version === undefined || profile.version === null) {
      errors.push('Profile version is required');
    }

    if (
      profile.identityCertificatePayloadUuid &&
      !isValidUUID(profile.identityCertificatePayloadUuid)
    ) {
      errors.push(
        `Identity Certificate Payload UUID is not valid: ${profile.identityCertificatePayloadUuid}`,
      );
    }

    if (profile.skipSetupItems && profile.skipSetupItems.length > 0) {
      const skipErrors = this._validateSkipSetupItems(profile.skipSetupItems);
      errors.push(...skipErrors);
    }

    if (errors.length > 0) {
      logger.warn(`[ProfileValidator] Validation failed with ${errors.length} error(s): ${errors.join('; ')}`);
      throw new ValidationError(errors[0], errors);
    }

    logger.debug('[ProfileValidator] Profile validation passed');
    return true;
  }

  _validateSkipSetupItems(items) {
    const errors = [];
    const corrected = [];

    for (const item of items) {
      if (VALID_SKIP_SETUP_ITEMS.includes(item)) {
        corrected.push(item);
      } else if (SKIP_SETUP_ITEM_ALIASES[item]) {
        const modern = SKIP_SETUP_ITEM_ALIASES[item];
        corrected.push(modern);
        logger.debug(
          `[ProfileValidator] Corrected legacy skip setup item "${item}" to "${modern}"`,
        );
      } else {
        errors.push(`Unsupported SkipSetupAssistantItems value: "${item}"`);
      }
    }

    return errors;
  }

  _isValidUrl(str) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

module.exports = new ProfileValidator();
