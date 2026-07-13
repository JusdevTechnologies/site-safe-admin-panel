const { createAuthStrategy, VALID_TYPES } = require('../../../../src/integrations/auth');
const ApiKeyStrategy = require('../../../../src/integrations/auth/ApiKeyStrategy');
const BearerTokenStrategy = require('../../../../src/integrations/auth/BearerTokenStrategy');
const ClientCertificateStrategy = require('../../../../src/integrations/auth/ClientCertificateStrategy');

describe('createAuthStrategy', () => {
  describe('api_key type', () => {
    it('returns an ApiKeyStrategy instance', () => {
      const strategy = createAuthStrategy('api_key', { apiKey: 'sk-123' });
      expect(strategy).toBeInstanceOf(ApiKeyStrategy);
      expect(strategy.getType()).toBe('api_key');
    });

    it('trims and lowercases the type', () => {
      const strategy = createAuthStrategy('  API_KEY  ', { apiKey: 'sk-123' });
      expect(strategy).toBeInstanceOf(ApiKeyStrategy);
    });

    it('throws when apiKey is missing', () => {
      expect(() => createAuthStrategy('api_key', {})).toThrow('NANOMDM_API_KEY is required');
    });

    it('throws when config is empty', () => {
      expect(() => createAuthStrategy('api_key', {})).toThrow('NANOMDM_API_KEY is required');
    });
  });

  describe('bearer_token type', () => {
    it('returns a BearerTokenStrategy instance', () => {
      const strategy = createAuthStrategy('bearer_token', { bearerToken: 'jwt-token' });
      expect(strategy).toBeInstanceOf(BearerTokenStrategy);
      expect(strategy.getType()).toBe('bearer_token');
    });

    it('trims and lowercases the type', () => {
      const strategy = createAuthStrategy('  BEARER_TOKEN  ', { bearerToken: 'jwt' });
      expect(strategy).toBeInstanceOf(BearerTokenStrategy);
    });

    it('throws when bearerToken is missing', () => {
      expect(() => createAuthStrategy('bearer_token', {})).toThrow(
        'NANOMDM_BEARER_TOKEN is required',
      );
    });

    it('throws when config is empty', () => {
      expect(() => createAuthStrategy('bearer_token', {})).toThrow(
        'NANOMDM_BEARER_TOKEN is required',
      );
    });
  });

  describe('client_certificate type', () => {
    it('returns a ClientCertificateStrategy instance', () => {
      const strategy = createAuthStrategy('client_certificate', {});
      expect(strategy).toBeInstanceOf(ClientCertificateStrategy);
      expect(strategy.getType()).toBe('client_certificate');
    });

    it('does not require any config', () => {
      expect(() => createAuthStrategy('client_certificate')).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('throws when type is null', () => {
      expect(() => createAuthStrategy(null, {})).toThrow(
        'NanoMDM authentication type is not configured',
      );
    });

    it('throws when type is undefined', () => {
      expect(() => createAuthStrategy(undefined, {})).toThrow(
        'NanoMDM authentication type is not configured',
      );
    });

    it('throws for unknown type', () => {
      expect(() => createAuthStrategy('unknown_type', {})).toThrow(
        'Unknown NanoMDM authentication type',
      );
    });

    it('includes valid types in unknown type error message', () => {
      expect(() => createAuthStrategy('invalid', {})).toThrow(VALID_TYPES.join(', '));
    });
  });
});
