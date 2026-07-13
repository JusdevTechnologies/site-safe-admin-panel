const fs = require('fs');

jest.mock('fs');

jest.mock('../../../config/environment', () => ({
  ade: {
    profileIdentifier: 'com.kokken.mdm.enrollment',
    checkinUrl: '',
    topic: 'com.apple.mgmt.TestTopicUUID',
    organization: 'TestOrg',
    organizationDisplayName: '',
    supportEmail: '',
    supportPhone: '',
    supportContact: '',
    language: 'en',
    region: 'US',
    department: '',
    rootCaCertPath: '',
    identityCertPath: '',
    identityCertPassword: '',
  },
  logging: { level: 'silent' },
}));

describe('CertificateLoader', () => {
  let CertificateLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    CertificateLoader = require('../../../src/services/profile/CertificateLoader');
  });

  describe('loadRootCACertificates', () => {
    it('returns empty array when no root CA path configured', async () => {
      const certs = await CertificateLoader.loadRootCACertificates();
      expect(certs).toEqual([]);
    });

    it('handles non-existent cert path gracefully', async () => {
      CertificateLoader._certPaths.rootCa = '/nonexistent/cert.pem';

      fs.statSync.mockImplementation(() => {
        const err = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });

      const certs = await CertificateLoader.loadRootCACertificates();
      expect(certs).toEqual([]);
    });

    it('loads a single PEM file and extracts DER', async () => {
      CertificateLoader._certPaths.rootCa = '/certs/root.pem';

      fs.statSync.mockReturnValue({ isDirectory: () => false });
      fs.readFileSync.mockReturnValue(
        [
          '-----BEGIN CERTIFICATE-----',
          'dGVzdGNlcnRpZmljYXRlZGF0YQ==',
          '-----END CERTIFICATE-----',
        ].join('\n'),
      );

      const certs = await CertificateLoader.loadRootCACertificates();
      expect(certs).toHaveLength(1);
      expect(certs[0].derBase64).toBe('dGVzdGNlcnRpZmljYXRlZGF0YQ==');
    });

    it('loads multiple certs from a directory', async () => {
      CertificateLoader._certPaths.rootCa = '/certs';

      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.readdirSync.mockReturnValue(['ca1.pem', 'ca2.pem']);
      fs.readFileSync.mockReturnValue(
        ['-----BEGIN CERTIFICATE-----', 'ZGVybWF0Y2hlcmQ=', '-----END CERTIFICATE-----'].join('\n'),
      );

      const certs = await CertificateLoader.loadRootCACertificates();
      expect(certs).toHaveLength(2);
    });

    it('skips non-cert files in directories', async () => {
      CertificateLoader._certPaths.rootCa = '/certs';

      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.readdirSync.mockReturnValue(['ca1.pem', 'notes.txt', 'ca2.crt']);
      fs.readFileSync.mockReturnValue('');

      const certs = await CertificateLoader.loadRootCACertificates();
      expect(certs).toHaveLength(0);
    });
  });

  describe('loadIdentityCertificate', () => {
    it('returns null when no identity cert path configured', async () => {
      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).toBeNull();
    });

    it('returns null for non-existent path', async () => {
      CertificateLoader._certPaths.identity = '/nonexistent/identity.p12';

      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).toBeNull();
    });

    it('loads and base64-encodes PKCS12 file', async () => {
      CertificateLoader._certPaths.identity = '/certs/identity.p12';

      const pkcs12Buffer = Buffer.from('fake-pkcs12-data');
      fs.readFileSync.mockReturnValue(pkcs12Buffer);

      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).not.toBeNull();
      expect(cert.displayName).toBe('MDM Identity Certificate');
      expect(cert.pkcs12Base64).toBe('ZmFrZS1wa2NzMTItZGF0YQ==');
    });
  });

  describe('_pemToDerBase64', () => {
    it('extracts base64 from PEM format', () => {
      const pem = [
        '-----BEGIN CERTIFICATE-----',
        'dGVzdGNlcnRkYXRh',
        '-----END CERTIFICATE-----',
      ].join('\n');

      const result = CertificateLoader._pemToDerBase64(pem);
      expect(result).toBe('dGVzdGNlcnRkYXRh');
    });

    it('handles PEM with line-wrapped base64 content', () => {
      const pem = [
        '-----BEGIN CERTIFICATE-----',
        'dGVzdGNl',
        'cnRkYXRh',
        '-----END CERTIFICATE-----',
      ].join('\n');

      const result = CertificateLoader._pemToDerBase64(pem);
      expect(result).toBe('dGVzdGNlcnRkYXRh');
    });

    it('handles raw base64 (non-PEM) input', () => {
      const result = CertificateLoader._pemToDerBase64('dGVzdGNlcnRkYXRh');
      expect(result).toBe('dGVzdGNlcnRkYXRh');
    });
  });
});
