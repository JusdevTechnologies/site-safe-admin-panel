const { isValidUUID } = require('../../utils/helpers');
const ValidationError = require('../../exceptions/ValidationError');

class ProfileValidator {
  validate(profile) {
    const errors = [];

    if (!profile.serverUrl) {
      errors.push('ServerURL is required');
    } else if (!this._isValidUrl(profile.serverUrl)) {
      errors.push(`ServerURL is not a valid URL: ${profile.serverUrl}`);
    }

    if (!profile.checkinUrl) {
      errors.push('CheckInURL is required');
    } else if (!this._isValidUrl(profile.checkinUrl)) {
      errors.push(`CheckInURL is not a valid URL: ${profile.checkinUrl}`);
    }

    if (!profile.topic) {
      errors.push('Topic is required');
    } else if (!profile.topic.startsWith('com.apple.mgmt.')) {
      errors.push('Topic must start with com.apple.mgmt.');
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

    if (
      profile.identityCertificatePayloadUuid &&
      !isValidUUID(profile.identityCertificatePayloadUuid)
    ) {
      errors.push(
        `Identity Certificate Payload UUID is not valid: ${profile.identityCertificatePayloadUuid}`,
      );
    }

    if (errors.length > 0) {
      throw new ValidationError(errors[0], errors);
    }

    return true;
  }

  _isValidUrl(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new ProfileValidator();
