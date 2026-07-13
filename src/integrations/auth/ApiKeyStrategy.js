const AuthenticationStrategy = require('./AuthenticationStrategy');

class ApiKeyStrategy extends AuthenticationStrategy {
  constructor(apiKey) {
    super();
    if (!apiKey) {
      throw new Error('API key is required for ApiKeyStrategy');
    }
    this._apiKey = apiKey;
  }

  getType() {
    return 'api_key';
  }

  apply(config) {
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-API-Key': this._apiKey,
      },
    };
  }
}

module.exports = ApiKeyStrategy;
