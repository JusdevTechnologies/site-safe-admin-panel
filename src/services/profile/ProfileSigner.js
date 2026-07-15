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
    this._caCertPath = environment.ade.rootCaCertPath || '';
    this._signingCert = null;
    this._signingKey = null;
    this._caCert = null;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  sign(xmlContent) {
    if (!this._enabled) {
      logger.warn('[ProfileSigner] CMS SIGNING DISABLED — returning unsigned content');
      logger.warn('[ProfileSigner] Apple devices may reject unsigned profiles');
      logger.warn('[ProfileSigner] ADE_SIGNING_ENABLED is not set to "true"');
      logger.warn(`[ProfileSigner] Signing cert path: ${this._certPath || 'NOT CONFIGURED'}`);
      logger.warn(`[ProfileSigner] Signing key path: ${this._keyPath || 'NOT CONFIGURED'}`);
      return { signed: false, content: xmlContent, signature: null };
    }

    logger.info('[ProfileSigner] CMS signing enabled — starting sign process');
    logger.info(`[ProfileSigner] Input XML size: ${xmlContent.length} bytes`);

    try {
      if (!this._signingCert || !this._signingKey) {
        logger.info('[ProfileSigner] Loading signing credentials...');
        this._loadSigningCredentials();
        logger.info('[ProfileSigner] Signing credentials loaded successfully');
      }

      logger.info(
        `[ProfileSigner] Signing cert CN: "${this._signingCert.subject.getField('CN')?.value || 'Unknown'}"`,
      );
      logger.info(
        `[ProfileSigner] Signing cert issuer: "${this._signingCert.issuer.getField('CN')?.value || 'Unknown'}"`,
      );

      const signStart = Date.now();
      const derBytes = this._signWithOpenssl(xmlContent);
      const signTime = Date.now() - signStart;
      logger.info(`[ProfileSigner] Openssl sign operation took ${signTime}ms`);

      const signature = forge.util.encode64(derBytes);
      logger.info(
        `[ProfileSigner] CMS signature size: ${signature.length} chars (${derBytes.length} bytes DER)`,
      );

      const wrapStart = Date.now();
      const signedContent = this._wrapSignedContent(signature);
      logger.info(
        `[ProfileSigner] Wrapped signed content: ${signedContent.length} bytes (${Date.now() - wrapStart}ms)`,
      );

      logger.info('[ProfileSigner] CMS signing completed successfully');
      return { signed: true, content: derBytes, signature };
    } catch (err) {
      logger.error(`[ProfileSigner] CMS SIGNING FAILED: ${err.message}`);
      logger.error(`[ProfileSigner] Stack: ${err.stack}`);
      logger.error('[ProfileSigner] Falling back to unsigned content — device may reject profile');
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

  _signWithOpenssl(xmlContent) {
    const { execSync } = require('child_process');
    const tmpDir = require('os').tmpdir();
    const uuid = require('uuid').v4();
    const inputPath = path.join(tmpDir, `profile-${uuid}.plist`);
    const outputPath = path.join(tmpDir, `profile-${uuid}.der`);

    try {
      fs.writeFileSync(inputPath, xmlContent, 'utf8');

      const certPath = path.resolve(this._certPath);
      const keyPath = path.resolve(this._keyPath);

      let cmd =
        `openssl smime -sign -signer "${certPath}" -inkey "${keyPath}" ` +
        `-outform der -nodetach -in "${inputPath}" -out "${outputPath}"`;

      if (this._caCertPath) {
        const caPath = path.resolve(this._caCertPath);
        if (fs.existsSync(caPath)) {
          cmd += ` -certfile "${caPath}"`;
        }
      }

      execSync(cmd, { stdio: 'pipe', timeout: 30000 });
      const derBytes = fs.readFileSync(outputPath);
      return derBytes;
    } finally {
      try { fs.unlinkSync(inputPath); } catch (_) {}
      try { fs.unlinkSync(outputPath); } catch (_) {}
    }
  }

  _loadSigningCredentials() {
    const certPath = path.resolve(this._certPath);
    const keyPath = path.resolve(this._keyPath);

    logger.info(`[ProfileSigner] Loading signing cert from: ${certPath}`);
    logger.info(`[ProfileSigner] Loading signing key from: ${keyPath}`);

    if (!fs.existsSync(certPath)) {
      throw new Error(`Signing certificate not found at ${certPath}`);
    }
    logger.info(`[ProfileSigner] Signing cert file exists (${fs.statSync(certPath).size} bytes)`);

    if (!fs.existsSync(keyPath)) {
      throw new Error(`Signing key not found at ${keyPath}`);
    }
    logger.info(`[ProfileSigner] Signing key file exists (${fs.statSync(keyPath).size} bytes)`);

    const certPem = fs.readFileSync(certPath, 'utf8');
    const keyPem = fs.readFileSync(keyPath, 'utf8');

    try {
      this._signingCert = forge.pki.certificateFromPem(certPem);
      const cn = this._signingCert.subject.getField('CN')?.value || 'Unknown';
      const issuer = this._signingCert.issuer.getField('CN')?.value || 'Unknown';
      logger.info(`[ProfileSigner] Loaded signing certificate: CN="${cn}", issuer="${issuer}"`);
    } catch (err) {
      throw new Error(`Failed to parse signing certificate: ${err.message}`);
    }

    try {
      this._signingKey = forge.pki.privateKeyFromPem(keyPem);
      logger.info('[ProfileSigner] Loaded signing private key successfully');
    } catch (err) {
      this._signingCert = null;
      throw new Error(`Failed to parse signing private key: ${err.message}`);
    }

    if (this._caCertPath) {
      const caPath = path.resolve(this._caCertPath);
      if (fs.existsSync(caPath)) {
        const caPem = fs.readFileSync(caPath, 'utf8');
        try {
          this._caCert = forge.pki.certificateFromPem(caPem);
          logger.info(`[ProfileSigner] Loaded CA cert for chain: CN="${this._caCert.subject.getField('CN')?.value || 'Unknown'}"`);
        } catch (_) {
          logger.warn('[ProfileSigner] Could not parse CA cert, chain will not be embedded');
        }
      }
    }
  }
}

module.exports = new ProfileSigner();
