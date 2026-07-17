const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class IdentityPayloadBuilder {
  build(certificate, identifier) {
    const payloadUuid = uuidv4();

    const payload = {
      PayloadType: 'com.apple.security.pkcs12',
      PayloadVersion: 1,
      PayloadIdentifier: `${identifier}.identity.${payloadUuid}`,
      PayloadUUID: payloadUuid,
      PayloadDisplayName: certificate.displayName || 'MDM Identity Certificate',
      PayloadDescription: certificate.description || 'Identity certificate for MDM enrollment',
      PayloadContent: certificate.rawData,
    };

    if (certificate.password) {
      payload.Password = certificate.password;
    }

    logger.info('[IdentityPayloadBuilder] Built identity payload');
    logger.info(`[IdentityPayloadBuilder]   PayloadUUID: ${payloadUuid}`);
    logger.info(`[IdentityPayloadBuilder]   PayloadIdentifier: ${payload.PayloadIdentifier}`);
    logger.info(
      `[IdentityPayloadBuilder]   PayloadContent: ${certificate.rawData ? certificate.rawData.length + ' bytes (PKCS#12)' : 'empty'}`,
    );
    logger.info(
      `[IdentityPayloadBuilder]   Certificate CN: ${certificate.commonName || 'Unknown'}`,
    );
    logger.info(
      `[IdentityPayloadBuilder]   Password: ${certificate.password ? 'set (' + certificate.password.length + ' chars)' : 'not set'}`,
    );

    return {
      payloadUuid,
      payload,
    };
  }
}

module.exports = new IdentityPayloadBuilder();
