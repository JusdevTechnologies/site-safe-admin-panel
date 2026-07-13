const { v4: uuidv4 } = require('uuid');

class IdentityPayloadBuilder {
  build(certificate, identifier) {
    const payloadUuid = uuidv4();

    return {
      payloadUuid,
      payload: {
        PayloadType: 'com.apple.security.pkcs12',
        PayloadVersion: 1,
        PayloadIdentifier: `${identifier}.identity.${payloadUuid}`,
        PayloadUUID: payloadUuid,
        PayloadDisplayName: certificate.displayName || 'MDM Identity Certificate',
        PayloadDescription: certificate.description || 'Identity certificate for MDM enrollment',
        PayloadContent: certificate.pkcs12Base64,
      },
    };
  }
}

module.exports = new IdentityPayloadBuilder();
