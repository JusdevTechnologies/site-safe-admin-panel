const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const logger = require('../../utils/logger');
const environment = require('../../../config/environment');

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
      logger.warn('[CertLoader] No root CA cert path configured — device may not trust MDM server');
      return [];
    }

    logger.info(`[CertLoader] Loading root CA certificates from: ${certPath}`);

    try {
      const resolvedPath = path.resolve(certPath);
      const stats = fs.statSync(resolvedPath);
      logger.info(
        `[CertLoader] Path resolved: ${resolvedPath} (${stats.isDirectory() ? 'directory' : 'file'})`,
      );

      let certs;
      if (stats.isDirectory()) {
        certs = this._loadCertDirectory(resolvedPath);
        logger.info(`[CertLoader] Found ${certs.length} cert file(s) in directory`);
      } else {
        const cert = this._loadCertFile(resolvedPath);
        certs = cert ? [cert] : [];
        logger.info(`[CertLoader] Loaded ${certs.length} cert(s) from file`);
      }

      logger.info(`[CertLoader] Validating ${certs.length} root CA certificate(s)...`);
      const validated = certs.filter((c) => this._validateRootCACert(c));
      logger.info(`[CertLoader] ${validated.length}/${certs.length} passed validation`);

      const ordered = this._orderCertChain(validated);
      logger.info(`[CertLoader] Certificate chain ordered: ${ordered.length} cert(s)`);

      ordered.forEach((c, i) => {
        logger.info(`[CertLoader]   Cert[${i}]: "${c.displayName}" (${c.rawData.length} bytes)`);
      });

      logger.info(`[CertLoader] Loaded ${ordered.length} root CA certificate(s) from ${certPath}`);
      return ordered;
    } catch (err) {
      logger.warn(
        `[CertLoader] Failed to load root CA certificates from ${certPath}: ${err.message}`,
      );
      logger.warn(
        '[CertLoader] Without root CA certs, the device may not trust the MDM server TLS connection',
      );
      return [];
    }
  }

  async loadIdentityCertificate() {
    const certPath = this._certPaths.identity;
    if (!certPath) {
      logger.warn(
        '[CertLoader] No identity cert path configured — MDM identity payload will be omitted',
      );
      logger.warn(
        '[CertLoader] Device MDM authentication will likely fail without identity certificate',
      );
      return null;
    }

    logger.info(`[CertLoader] Loading identity certificate from: ${certPath}`);

    try {
      const resolvedPath = path.resolve(certPath);
      logger.info(`[CertLoader] Path resolved: ${resolvedPath}`);
      const data = fs.readFileSync(resolvedPath);
      logger.info(`[CertLoader] Read ${data.length} bytes from identity cert file`);

      logger.info('[CertLoader] Validating PKCS#12 bundle...');
      const validation = this._validatePKCS12(data, this._identityPassword);
      if (!validation.valid) {
        logger.error(`[CertLoader] Identity certificate VALIDATION FAILED: ${validation.error}`);
        return null;
      }

      logger.info('[CertLoader] Identity certificate loaded and validated successfully');
      logger.info(`[CertLoader]   Common Name (CN): ${validation.commonName}`);
      logger.info(
        `[CertLoader]   Expires: ${validation.expirationDate ? validation.expirationDate.toISOString() : 'Unknown'}`,
      );
      logger.info(
        `[CertLoader]   Days remaining: ${validation.expirationDate ? Math.floor((validation.expirationDate - new Date()) / (1000 * 60 * 60 * 24)) : 'Unknown'}`,
      );
      logger.info(`[CertLoader]   Data size: ${data.length} bytes`);

      return {
        displayName: 'MDM Identity Certificate',
        description: 'Identity certificate for MDM enrollment',
        rawData: data,
        expirationDate: validation.expirationDate,
        commonName: validation.commonName,
      };
    } catch (err) {
      logger.error(
        `[CertLoader] Failed to load identity certificate from ${certPath}: ${err.message}`,
      );
      return null;
    }
  }

  _validatePKCS12(p12Buffer, password) {
    try {
      const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBagsPlain = p12.getBags({ bagType: forge.pki.oids.keyBag });
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

      const hasKey =
        (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] &&
          keyBags[forge.pki.oids.pkcs8ShroudedKeyBag].length > 0) ||
        (keyBagsPlain[forge.pki.oids.keyBag] && keyBagsPlain[forge.pki.oids.keyBag].length > 0);

      if (!hasKey) {
        return { valid: false, error: 'No private key found in PKCS#12 bundle' };
      }

      const certList = certBags[forge.pki.oids.certBag] || [];
      if (certList.length === 0) {
        return { valid: false, error: 'No certificate found in PKCS#12 bundle' };
      }

      const leafCert = certList[0].cert;
      const now = new Date();

      if (leafCert.validity.notAfter && leafCert.validity.notAfter < now) {
        return {
          valid: false,
          error: `Identity certificate expired on ${leafCert.validity.notAfter.toISOString()}`,
        };
      }

      if (leafCert.validity.notBefore && leafCert.validity.notBefore > now) {
        return {
          valid: false,
          error: `Identity certificate not yet valid until ${leafCert.validity.notBefore.toISOString()}`,
        };
      }

      const commonName = leafCert.subject.getField('CN')
        ? leafCert.subject.getField('CN').value
        : 'Unknown';

      logger.info(
        `[CertLoader] PKCS#12 validated: CN="${commonName}", expires=${leafCert.validity.notAfter?.toISOString() || 'unknown'}`,
      );

      return {
        valid: true,
        expirationDate: leafCert.validity.notAfter || null,
        commonName,
      };
    } catch (err) {
      const message = err.message.toLowerCase();
      if (
        message.includes('password') ||
        message.includes('invalid password') ||
        message.includes('pkcs12')
      ) {
        return {
          valid: false,
          error: `Invalid identity certificate password or corrupted PKCS#12 file: ${err.message}`,
        };
      }
      return { valid: false, error: `PKCS#12 parsing failed: ${err.message}` };
    }
  }

  _validateRootCACert(cert) {
    try {
      const pem = this._bufferToPem(cert.rawData);
      forge.pki.certificateFromPem(pem);
      return true;
    } catch (err) {
      logger.warn(`[CertLoader] Invalid root CA certificate "${cert.displayName}": ${err.message}`);
      return false;
    }
  }

  _orderCertChain(certs) {
    if (certs.length <= 1) return certs;

    const parsed = certs.map((c) => {
      try {
        const pem = this._bufferToPem(c.rawData);
        const forgeCert = forge.pki.certificateFromPem(pem);
        const isSelfSigned =
          forgeCert.subject.attributes.length > 0 &&
          forgeCert.issuer.attributes.length > 0 &&
          forgeCert.subject.hash === forgeCert.issuer.hash;
        return { ...c, _isSelfSigned: isSelfSigned, _forgeCert: forgeCert };
      } catch {
        return { ...c, _isSelfSigned: true };
      }
    });

    parsed.sort((a, b) => {
      if (a._isSelfSigned === b._isSelfSigned) return 0;
      return a._isSelfSigned ? 1 : -1;
    });

    return parsed.map(({ _isSelfSigned, _forgeCert, ...cert }) => cert);
  }

  _bufferToPem(rawData) {
    const b64 = rawData.toString('base64');
    const lines = [];
    for (let i = 0; i < b64.length; i += 64) {
      lines.push(b64.slice(i, i + 64));
    }
    return ['-----BEGIN CERTIFICATE-----', ...lines, '-----END CERTIFICATE-----'].join('\n');
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
      const derBuffer = this._pemToDerBuffer(raw);

      if (!derBuffer || derBuffer.length === 0) {
        logger.warn(`[CertLoader] Could not extract DER from ${filePath}`);
        return null;
      }

      return {
        displayName: path.basename(filePath, path.extname(filePath)),
        description: `Root CA: ${path.basename(filePath)}`,
        rawData: derBuffer,
      };
    } catch (err) {
      logger.warn(`[CertLoader] Error reading cert file ${filePath}: ${err.message}`);
      return null;
    }
  }

  _pemToDerBuffer(pemContent) {
    const pemRegex = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/;
    const match = pemContent.match(pemRegex);

    if (!match) {
      const trimmed = pemContent.trim();
      if (!trimmed || !/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) {
        return null;
      }
      return Buffer.from(trimmed, 'base64');
    }

    const base64Data = match[1].replace(/\s/g, '');
    try {
      return Buffer.from(base64Data, 'base64');
    } catch {
      return null;
    }
  }

  _isCertFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.pem', '.crt', '.cer', '.der'].includes(ext);
  }
}

module.exports = new CertificateLoader();
