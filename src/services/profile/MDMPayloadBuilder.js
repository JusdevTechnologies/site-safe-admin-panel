const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class MDMPayloadBuilder {
  build({
    identifier,
    serverUrl,
    checkinUrl,
    topic,
    isSupervised = true,
    isMandatory = true,
    isMDMRemovable = false,
    awaitDeviceConfigured = true,
    identityPayloadUuid = null,
    anchorCerts = [],
    accessRights = 8191,
  }) {
    const payloadUuid = uuidv4();

    const payload = {
      PayloadType: 'com.apple.mdm',
      PayloadVersion: 1,
      PayloadIdentifier: `${identifier}.mdm.${payloadUuid}`,
      PayloadUUID: payloadUuid,
      PayloadDisplayName: 'MDM Profile',
      PayloadDescription: 'Enables Mobile Device Management',
      ServerURL: serverUrl,
      CheckInURL: checkinUrl,
      Topic: topic,
      SignMessage: true,
      IsSupervised: isSupervised,
      IsMandatory: isMandatory,
      IsMDMRemovable: isMDMRemovable,
      AwaitDeviceConfigured: awaitDeviceConfigured,
      AccessRights: accessRights,
      UserIdentity: false,
      CheckInWhenRemoving: true,
    };

    if (topic && topic.includes('.')) {
      payload.PushMagicTopic = topic;
    }

    if (identityPayloadUuid) {
      payload.IdentityCertificateUUID = identityPayloadUuid;
    }

    if (anchorCerts.length > 0) {
      payload.AnchorCertificates = anchorCerts.map((cert) => cert.rawData);
    }

    logger.debug(
      `[MDMPayloadBuilder] Built MDM payload ${payloadUuid} for topic "${topic}"`,
    );

    return payload;
  }
}

module.exports = new MDMPayloadBuilder();
