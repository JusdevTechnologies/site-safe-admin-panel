const AuthenticationStrategy = require('./AuthenticationStrategy');

class BearerTokenStrategy extends AuthenticationStrategy {
  constructor(token) {
    super();
    if (!token) {
      throw new Error('Bearer token is required for BearerTokenStrategy');
    }
    this._token = token;
  }

  getType() {
    return 'bearer_token';
  }

  apply(config) {
    return {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${this._token}`,
      },
    };
  }
}

module.exports = BearerTokenStrategy;
