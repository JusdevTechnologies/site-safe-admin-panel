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

    logger.info('[DeviceIdentityGen] Packaging as PKCS#12...');
    const p12Start = Date.now();

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], DEVICE_CERT_PASSWORD, {
      friendlyName: `SiteSafe Device Identity - ${serialNumber}`,
    });
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Buffer = Buffer.from(p12Der, 'binary');
    logger.info(`[DeviceIdentityGen] PKCS#12 packaged in ${Date.now() - p12Start}ms`);
    logger.info(`[DeviceIdentityGen] PKCS#12 size: ${p12Buffer.length} bytes`);

    const totalTime = Date.now() - startTime;
    logger.info('[DeviceIdentityGen] === END GENERATE DEVICE IDENTITY CERTIFICATE ===');
    logger.info(`[DeviceIdentityGen] Total time: ${totalTime}ms`);
    logger.info('[DeviceIdentityGen] ========================================================');

    return {
      displayName: `Device Identity - ${serialNumber}`,
      description: `Per-device identity certificate for ${serialNumber}`,
      rawData: p12Buffer,
      expirationDate,
      commonName,
      password: DEVICE_CERT_PASSWORD,
    };
  }
}

module.exports = new DeviceIdentityGenerator();
