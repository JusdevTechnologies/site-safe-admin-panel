const logger = require('../../../../src/utils/logger');

describe('AuthenticationStrategy', () => {
  describe('ApiKeyStrategy', () => {
    const ApiKeyStrategy = require('../../../../src/integrations/auth/ApiKeyStrategy');

    it('creates a strategy with the given API key', () => {
      const strategy = new ApiKeyStrategy('sk-test-key');
      expect(strategy.getType()).toBe('api_key');
    });

    it('adds X-API-Key header to config', () => {
      const strategy = new ApiKeyStrategy('sk-test-key');
      const config = { headers: { 'Content-Type': 'application/json' } };

      const result = strategy.apply(config);

      expect(result.headers['X-API-Key']).toBe('sk-test-key');
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('preserves existing headers when applying', () => {
      const strategy = new ApiKeyStrategy('sk-test-key');
      const config = { headers: { 'Content-Type': 'application/json', Accept: 'text/plain' } };

      const result = strategy.apply(config);

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Accept']).toBe('text/plain');
      expect(result.headers['X-API-Key']).toBe('sk-test-key');
    });

    it('preserves non-header config properties', () => {
      const strategy = new ApiKeyStrategy('sk-test-key');
      const config = {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
        url: '/v1/devices',
        params: { page: 1 },
      };

      const result = strategy.apply(config);

      expect(result.method).toBe('GET');
      expect(result.url).toBe('/v1/devices');
      expect(result.params).toEqual({ page: 1 });
    });

    it('works with config that has no existing headers', () => {
      const strategy = new ApiKeyStrategy('sk-test-key');
      const config = {};

      const result = strategy.apply(config);

      expect(result.headers['X-API-Key']).toBe('sk-test-key');
    });

    it('throws when constructed without API key', () => {
      expect(() => new ApiKeyStrategy()).toThrow('API key is required');
    });

    it('throws when constructed with empty API key', () => {
      expect(() => new ApiKeyStrategy('')).toThrow('API key is required');
    });
  });

  describe('BearerTokenStrategy', () => {
    const BearerTokenStrategy = require('../../../../src/integrations/auth/BearerTokenStrategy');

    it('creates a strategy with the given bearer token', () => {
      const strategy = new BearerTokenStrategy('eyJhbGciOiJIUzI1NiJ9.token');
      expect(strategy.getType()).toBe('bearer_token');
    });

    it('adds Authorization: Bearer header to config', () => {
      const strategy = new BearerTokenStrategy('eyJhbGciOiJIUzI1NiJ9.token');
      const config = { headers: { 'Content-Type': 'application/json' } };

      const result = strategy.apply(config);

      expect(result.headers['Authorization']).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.token');
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('preserves existing headers when applying', () => {
      const strategy = new BearerTokenStrategy('my-token');
      const config = { headers: { Accept: 'application/json' } };

      const result = strategy.apply(config);

      expect(result.headers['Accept']).toBe('application/json');
      expect(result.headers['Authorization']).toBe('Bearer my-token');
    });

    it('preserves non-header config properties', () => {
      const strategy = new BearerTokenStrategy('my-token');
      const config = {
        headers: {},
        method: 'POST',
        url: '/v1/commands',
        data: { command: 'DeviceLock' },
      };

      const result = strategy.apply(config);

      expect(result.method).toBe('POST');
      expect(result.url).toBe('/v1/commands');
      expect(result.data).toEqual({ command: 'DeviceLock' });
    });

    it('works with config that has no existing headers', () => {
      const strategy = new BearerTokenStrategy('my-token');
      const config = {};

      const result = strategy.apply(config);

      expect(result.headers['Authorization']).toBe('Bearer my-token');
    });

    it('throws when constructed without token', () => {
      expect(() => new BearerTokenStrategy()).toThrow('Bearer token is required');
    });

    it('throws when constructed with empty token', () => {
      expect(() => new BearerTokenStrategy('')).toThrow('Bearer token is required');
    });
  });

  describe('ClientCertificateStrategy', () => {
    const ClientCertificateStrategy = require('../../../../src/integrations/auth/ClientCertificateStrategy');

    it('creates a strategy of type client_certificate', () => {
      const strategy = new ClientCertificateStrategy();
      expect(strategy.getType()).toBe('client_certificate');
    });

    it('returns config unchanged', () => {
      const strategy = new ClientCertificateStrategy();
      const config = { headers: { 'Content-Type': 'application/json' }, method: 'GET' };

      const result = strategy.apply(config);

      expect(result).toEqual(config);
    });

    it('logs a warning on construction', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      new ClientCertificateStrategy();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not yet implemented'));
      warnSpy.mockRestore();
    });
  });
});
