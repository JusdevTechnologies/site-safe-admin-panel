const AuthenticationStrategy = require('./AuthenticationStrategy');
const logger = require('../../utils/logger');

class ClientCertificateStrategy extends AuthenticationStrategy {
  constructor() {
    super();
    logger.warn(
      '[NanoMDM] ClientCertificateStrategy is not yet implemented. ' +
        'Requests will be sent without additional authentication headers.',
    );
  }

  getType() {
    return 'client_certificate';
  }

  apply(config) {
    logger.debug('[NanoMDM] ClientCertificateStrategy: no request-level auth to apply');
    return config;
  }
}

module.exports = ClientCertificateStrategy;
