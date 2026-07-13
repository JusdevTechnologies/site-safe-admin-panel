const ApiKeyStrategy = require('./ApiKeyStrategy');
const BearerTokenStrategy = require('./BearerTokenStrategy');
const ClientCertificateStrategy = require('./ClientCertificateStrategy');

const VALID_TYPES = ['api_key', 'bearer_token', 'client_certificate'];

function createAuthStrategy(type, config = {}) {
  if (!type) {
    throw new Error(
      'NanoMDM authentication type is not configured. ' +
        'Set NANOMDM_AUTH_TYPE to one of: ' +
        VALID_TYPES.join(', '),
    );
  }

  const normalized = type.toLowerCase().trim();

  switch (normalized) {
    case 'api_key':
      if (!config.apiKey) {
        throw new Error('NANOMDM_API_KEY is required when NANOMDM_AUTH_TYPE is "api_key"');
      }
      return new ApiKeyStrategy(config.apiKey);

    case 'bearer_token':
      if (!config.bearerToken) {
        throw new Error(
          'NANOMDM_BEARER_TOKEN is required when NANOMDM_AUTH_TYPE is "bearer_token"',
        );
      }
      return new BearerTokenStrategy(config.bearerToken);

    case 'client_certificate':
      return new ClientCertificateStrategy();

    default:
      throw new Error(
        `Unknown NanoMDM authentication type "${type}". ` +
          `Valid types are: ${VALID_TYPES.join(', ')}`,
      );
  }
}

module.exports = { createAuthStrategy, VALID_TYPES };
