const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class SCEPPayloadBuilder {
  build({ identifier, url, challenge, subject }) {
    const payloadUuid = uuidv4();

    const payload = {
      PayloadType: 'com.apple.security.scep',
      PayloadVersion: 1,
      PayloadIdentifier: `${identifier}.scep.${payloadUuid}`,
      PayloadUUID: payloadUuid,
      PayloadDisplayName: 'MDM Identity',
      URL: url,
      Challenge: challenge,
      Subject: [[['CN', subject]]],
      Keysize: 2048,
      KeyType: 'RSA',
      KeyUsage: 5,
      Retries: 3,
      RetryDelay: 10,
    };

    logger.info('[SCEPPayloadBuilder] Built SCEP payload');
    logger.info(`[SCEPPayloadBuilder]   PayloadUUID: ${payloadUuid}`);
    logger.info(`[SCEPPayloadBuilder]   PayloadIdentifier: ${payload.PayloadIdentifier}`);
    logger.info(`[SCEPPayloadBuilder]   URL: ${url}`);
    logger.info(`[SCEPPayloadBuilder]   Subject: CN=${subject}`);

    return {
      payloadUuid,
      payload,
    };
  }
}

module.exports = new SCEPPayloadBuilder();
