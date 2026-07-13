const logger = require('../../utils/logger');

class ProfileSigner {
  constructor() {
    this._enabled = false;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  sign(xmlContent) {
    if (!this._enabled) {
      logger.debug('[ProfileSigner] CMS signing disabled (POC mode) — returning unsigned content');
      return {
        signed: false,
        content: xmlContent,
        signature: null,
      };
    }

    logger.info('[ProfileSigner] CMS signing requested — not yet implemented');
    return {
      signed: false,
      content: xmlContent,
      signature: null,
    };
  }

  wrapSignedContent(xmlContent, signature) {
    if (!signature) {
      return xmlContent;
    }

    return [
      xmlContent,
      '',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>PayloadContent</key>',
      `  <data>${signature}</data>`,
      '</dict>',
      '</plist>',
    ].join('\n');
  }
}

module.exports = new ProfileSigner();
