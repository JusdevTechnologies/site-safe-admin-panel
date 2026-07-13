const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const logger = require('../../utils/logger');
const environment = require('../../../config/environment');

class ProfileSigner {
  constructor() {
    this._enabled = environment.ade.signingEnabled || false;
    this._certPath = environment.ade.signingCertPath || '';
    this._keyPath = environment.ade.signingKeyPath || '';
    this._signingCert = null;
    this._signingKey = null;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  sign(xmlContent) {
    if (!this._enabled) {
      logger.debug('[ProfileSigner] CMS signing disabled — returning unsigned content');
      return { signed: false, content: xmlContent, signature: null };
    }

    try {
      if (!this._signingCert || !this._signingKey) {
        this._loadSigningCredentials();
      }

      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(xmlContent, 'utf8');
      p7.addCertificate(this._signingCert);
      p7.addSigner({
        key: this._signingKey,
        certificate: this._signingCert,
        digestAlgorithm: forge.pki.oids.sha256,
      });
      p7.sign({ detached: false });

      const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
      const signature = forge.util.encode64(derBytes);

      const signedContent = this._wrapSignedContent(signature);

      logger.info('[ProfileSigner] CMS signing completed successfully');
      return { signed: true, content: signedContent, signature };
    } catch (err) {
      logger.error(`[ProfileSigner] CMS signing failed: ${err.message}`);
      return { signed: false, content: xmlContent, signature: null };
    }
  }

  wrapSignedContent(xmlContent, signature) {
    if (!signature) {
      return xmlContent;
    }
    return this._wrapSignedContent(signature);
  }

  _wrapSignedContent(signature) {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>PayloadContent</key>',
      `  <data>${signature}</data>`,
      '</dict>',
      '</plist>',
    ];
    return lines.join('\n');
  }

  _loadSigningCredentials() {
    const certPath = path.resolve(this._certPath);
    const keyPath = path.resolve(this._keyPath);

    if (!fs.existsSync(certPath)) {
      throw new Error(`Signing certificate not found at ${certPath}`);
    }
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Signing key not found at ${keyPath}`);
    }

    const certPem = fs.readFileSync(certPath, 'utf8');
    const keyPem = fs.readFileSync(keyPath, 'utf8');

    try {
      this._signingCert = forge.pki.certificateFromPem(certPem);
      logger.info(
        `[ProfileSigner] Loaded signing certificate: CN="${this._signingCert.subject.getField('CN')?.value || 'Unknown'}"`,
      );
    } catch (err) {
      throw new Error(`Failed to parse signing certificate: ${err.message}`);
    }

    try {
      this._signingKey = forge.pki.privateKeyFromPem(keyPem);
      logger.debug('[ProfileSigner] Loaded signing private key');
    } catch (err) {
      this._signingCert = null;
      throw new Error(`Failed to parse signing private key: ${err.message}`);
    }
  }
}

module.exports = new ProfileSigner();
