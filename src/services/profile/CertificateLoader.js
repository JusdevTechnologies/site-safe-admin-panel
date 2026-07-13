const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const environment = require('../../../config/environment');
const { CERTIFICATE_TYPES } = require('../../constants');

class CertificateLoader {
  constructor() {
    this._certPaths = {
      rootCa: environment.ade.rootCaCertPath || '',
      identity: environment.ade.identityCertPath || '',
    };
    this._identityPassword = environment.ade.identityCertPassword || '';
  }

  async loadRootCACertificates() {
    const certPath = this._certPaths.rootCa;
    if (!certPath) {
      logger.debug('[CertLoader] No root CA cert path configured');
      return [];
    }

    try {
      const resolvedPath = path.resolve(certPath);
      const stats = fs.statSync(resolvedPath);

      if (stats.isDirectory()) {
        return this._loadCertDirectory(resolvedPath);
      }

      const cert = this._loadCertFile(resolvedPath);
      return cert ? [cert] : [];
    } catch (err) {
      logger.warn(
        `[CertLoader] Failed to load root CA certificates from ${certPath}: ${err.message}`,
      );
      return [];
    }
  }

  async loadIdentityCertificate() {
    const certPath = this._certPaths.identity;
    if (!certPath) {
      logger.debug('[CertLoader] No identity cert path configured');
      return null;
    }

    try {
      const resolvedPath = path.resolve(certPath);
      const data = fs.readFileSync(resolvedPath);
      const base64 = data.toString('base64');

      return {
        displayName: 'MDM Identity Certificate',
        description: 'Identity certificate for MDM enrollment',
        pkcs12Base64: base64,
      };
    } catch (err) {
      logger.warn(
        `[CertLoader] Failed to load identity certificate from ${certPath}: ${err.message}`,
      );
      return null;
    }
  }

  _loadCertDirectory(dirPath) {
    const certs = [];
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      if (this._isCertFile(entry)) {
        const cert = this._loadCertFile(fullPath);
        if (cert) {
          certs.push(cert);
        }
      }
    }

    return certs;
  }

  _loadCertFile(filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const derBase64 = this._pemToDerBase64(raw);

      if (!derBase64) {
        logger.warn(`[CertLoader] Could not extract DER from ${filePath}`);
        return null;
      }

      return {
        displayName: path.basename(filePath, path.extname(filePath)),
        description: `Root CA: ${path.basename(filePath)}`,
        derBase64,
      };
    } catch (err) {
      logger.warn(`[CertLoader] Error reading cert file ${filePath}: ${err.message}`);
      return null;
    }
  }

  _pemToDerBase64(pemContent) {
    const pemRegex = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/;
    const match = pemContent.match(pemRegex);

    if (!match) {
      return Buffer.from(pemContent.trim(), 'base64').toString('base64');
    }

    const base64Data = match[1].replace(/\s/g, '');
    try {
      const der = Buffer.from(base64Data, 'base64');
      return der.toString('base64');
    } catch {
      return base64Data;
    }
  }

  _isCertFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.pem', '.crt', '.cer', '.der'].includes(ext);
  }
}

module.exports = new CertificateLoader();
