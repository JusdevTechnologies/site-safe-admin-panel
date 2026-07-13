const { v4: uuidv4 } = require('uuid');

class RootCAPayloadBuilder {
  build(certificate, identifier) {
    const payloadUuid = uuidv4();

    return {
      PayloadType: 'com.apple.security.root',
      PayloadVersion: 1,
      PayloadIdentifier: `${identifier}.rootca.${payloadUuid}`,
      PayloadUUID: payloadUuid,
      PayloadDisplayName: certificate.displayName || 'Root CA Certificate',
      PayloadDescription: certificate.description || 'Root CA Certificate for MDM',
      PayloadContent: certificate.derBase64,
    };
  }
}

module.exports = new RootCAPayloadBuilder();
