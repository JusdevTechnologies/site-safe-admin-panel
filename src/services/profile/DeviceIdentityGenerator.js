const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const forge = require('node-forge');
const logger = require('../../utils/logger');

const DEVICE_CERT_PASSWORD = 'device';
const DEVICE_CERT_VALIDITY_YEARS = 20;

class DeviceIdentityGenerator {
  generate(serialNumber) {
    const startTime = Date.now();

    logger.info('[DeviceIdentityGen] ========================================================');
    logger.info('[DeviceIdentityGen] === GENERATE DEVICE IDENTITY CERTIFICATE ===');
    logger.info(`[DeviceIdentityGen] Serial number: ${serialNumber}`);

    const friendlyName = `SiteSafe Device Identity - ${serialNumber}`;

    logger.info('[DeviceIdentityGen] Generating RSA 2048-bit keypair...');
    const keygenStart = Date.now();
    const keys = forge.pki.rsa.generateKeyPair(2048);
    logger.info(`[DeviceIdentityGen] Keypair generated in ${Date.now() - keygenStart}ms`);

    logger.info('[DeviceIdentityGen] Creating self-signed X.509 certificate...');
    const certStart = Date.now();
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;

    const serial = forge.util.bytesToHex(forge.random.getBytesSync(16));
    cert.serialNumber = serial;

    const now = new Date();
    cert.validity.notBefore = now;
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + DEVICE_CERT_VALIDITY_YEARS);
    cert.validity.notAfter = expiry;

    const attrs = [
      { name: 'commonName', value: serialNumber },
      { name: 'organizationName', value: 'SiteSafe' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false,
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        clientAuth: true,
      },
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());
    logger.info(`[DeviceIdentityGen] Certificate created in ${Date.now() - certStart}ms`);

    const commonName = cert.subject.getField('CN').value;
    const expirationDate = cert.validity.notAfter;
    logger.info(`[DeviceIdentityGen]   CN: ${commonName}`);
    logger.info(`[DeviceIdentityGen]   Serial: ${serial}`);
    logger.info(`[DeviceIdentityGen]   Expires: ${expirationDate.toISOString()}`);

    logger.info('[DeviceIdentityGen] Packaging as PKCS#12 via openssl (legacy format)...');
    const p12Start = Date.now();

    const tmpDir = os.tmpdir();
    const tmpKey = path.join(tmpDir, `device-key-${serial}.pem`);
    const tmpCrt = path.join(tmpDir, `device-crt-${serial}.pem`);
    const tmpP12 = path.join(tmpDir, `device-p12-${serial}.p12`);

    try {
      fs.writeFileSync(tmpKey, forge.pki.privateKeyToPem(keys.privateKey));
      fs.writeFileSync(tmpCrt, forge.pki.certificateToPem(cert));

      const cmd =
        `openssl pkcs12 -export` +
        ` -legacy -provider default -provider legacy` +
        ` -in "${tmpCrt}"` +
        ` -inkey "${tmpKey}"` +
        ` -out "${tmpP12}"` +
        ` -passout pass:${DEVICE_CERT_PASSWORD}` +
        ` -name "${friendlyName}"`;

      execSync(cmd, { stdio: 'pipe', timeout: 30000 });

      const p12Buffer = fs.readFileSync(tmpP12);
      logger.info(`[DeviceIdentityGen] PKCS#12 packaged in ${Date.now() - p12Start}ms`);
      logger.info(`[DeviceIdentityGen] PKCS#12 size: ${p12Buffer.length} bytes`);
      logger.info(`[DeviceIdentityGen] PKCS#12 algorithm: legacy (3DES/RC2) — iOS-compatible`);

      const totalTime = Date.now() - startTime;
      logger.info('[DeviceIdentityGen] === END GENERATE DEVICE IDENTITY CERTIFICATE ===');
      logger.info(`[DeviceIdentityGen] Total time: ${totalTime}ms`);
      logger.info('[DeviceIdentityGen] ========================================================');

      return {
        displayName: friendlyName,
        description: `Per-device identity certificate for ${serialNumber}`,
        rawData: p12Buffer,
        expirationDate,
        commonName,
        password: DEVICE_CERT_PASSWORD,
      };
    } finally {
      try {
        fs.unlinkSync(tmpKey);
      } catch (_) {}
      try {
        fs.unlinkSync(tmpCrt);
      } catch (_) {}
      try {
        fs.unlinkSync(tmpP12);
      } catch (_) {}
    }
  }
}

module.exports = new DeviceIdentityGenerator();
