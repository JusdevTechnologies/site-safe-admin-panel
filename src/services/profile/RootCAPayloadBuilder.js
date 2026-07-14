const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class RootCAPayloadBuilder {
  build(certificate, identifier) {
    const payloadUuid = uuidv4();

    const payload = {
      PayloadType: 'com.apple.security.root',
      PayloadVersion: 1,
      PayloadIdentifier: `${identifier}.rootca.${payloadUuid}`,
      PayloadUUID: payloadUuid,
      PayloadDisplayName: certificate.displayName || 'Root CA Certificate',
      PayloadDescription: certificate.description || 'Root CA Certificate for MDM',
      PayloadContent: certificate.rawData,
    };

    logger.info(
      `[RootCAPayloadBuilder] Built root CA payload ${payloadUuid} for "${certificate.displayName}"` +
        ` (rawData: ${certificate.rawData ? certificate.rawData.length + ' bytes' : 'empty'})`,
    );

    return payload;
  }
}

module.exports = new RootCAPayloadBuilder();
