class AuthenticationStrategy {
  getType() {
    throw new Error('AuthenticationStrategy subclass must implement getType()');
  }

  apply(_config) {
    throw new Error('AuthenticationStrategy subclass must implement apply(config)');
  }
}

module.exports = AuthenticationStrategy;
