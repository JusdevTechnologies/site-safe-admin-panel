const fs = require('fs');
const forge = require('node-forge');

jest.mock('fs');

jest.mock('node-forge', () => ({
  util: {
    createBuffer: jest.fn(),
  },
  asn1: {
    fromDer: jest.fn(),
  },
  pkcs12: {
    pkcs12FromAsn1: jest.fn(),
  },
  pki: {
    oids: {
      pkcs8ShroudedKeyBag: '1.2.840.113549.1.12.10.1.2',
      keyBag: '1.2.840.113549.1.12.10.1.1',
      certBag: '1.2.840.113549.1.12.10.1.3',
    },
    certificateFromPem: jest.fn(),
  },
}));

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
    signingEnabled: false,
    signingCertPath: '',
    signingKeyPath: '',
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
      expect(certs[0].rawData).toBeInstanceOf(Buffer);
      expect(certs[0].rawData.toString('base64')).toBe('dGVzdGNlcnRpZmljYXRlZGF0YQ==');
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
    const mockP12Buffer = Buffer.from('fake-pkcs12-data');

    function mockValidPkcs12() {
      const mockCert = {
        validity: {
          notAfter: new Date('2030-01-01'),
          notBefore: new Date('2020-01-01'),
        },
        subject: {
          getField: jest.fn().mockReturnValue({ value: 'MDM Identity' }),
        },
      };

      const mockKeyBags = {};
      mockKeyBags[forge.pki.oids.pkcs8ShroudedKeyBag] = [{ key: 'private-key-data' }];

      const mockCertBags = {};
      mockCertBags[forge.pki.oids.certBag] = [{ cert: mockCert }];

      forge.pkcs12.pkcs12FromAsn1.mockReturnValue({
        getBags: jest.fn(({ bagType }) => {
          if (bagType === forge.pki.oids.pkcs8ShroudedKeyBag || bagType === forge.pki.oids.keyBag) {
            return mockKeyBags;
          }
          if (bagType === forge.pki.oids.certBag) {
            return mockCertBags;
          }
          return {};
        }),
      });

      forge.asn1.fromDer.mockReturnValue('asn1-data');
      forge.util.createBuffer.mockReturnValue('buffer-data');
    }

    it('returns null when no identity cert path configured', async () => {
      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).toBeNull();
    });

    it('returns null for non-existent path', async () => {
      CertificateLoader._certPaths.identity = '/nonexistent/identity.p12';
      CertificateLoader._identityPassword = 'password';

      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).toBeNull();
    });

    it('loads and validates PKCS12 file successfully', async () => {
      CertificateLoader._certPaths.identity = '/certs/identity.p12';
      CertificateLoader._identityPassword = 'testpassword';

      fs.readFileSync.mockReturnValue(mockP12Buffer);
      mockValidPkcs12();

      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).not.toBeNull();
      expect(cert.displayName).toBe('MDM Identity Certificate');
      expect(cert.rawData).toEqual(mockP12Buffer);
      expect(cert.commonName).toBe('MDM Identity');
      expect(cert.expirationDate).toBeInstanceOf(Date);
    });

    it('returns null when PKCS12 password is wrong', async () => {
      CertificateLoader._certPaths.identity = '/certs/identity.p12';
      CertificateLoader._identityPassword = 'wrongpassword';

      fs.readFileSync.mockReturnValue(mockP12Buffer);

      forge.pkcs12.pkcs12FromAsn1.mockImplementation(() => {
        throw new Error('Invalid password');
      });
      forge.asn1.fromDer.mockReturnValue('asn1-data');
      forge.util.createBuffer.mockReturnValue('buffer-data');

      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).toBeNull();
    });

    it('returns null when PKCS12 has no private key', async () => {
      CertificateLoader._certPaths.identity = '/certs/identity.p12';
      CertificateLoader._identityPassword = 'testpassword';

      fs.readFileSync.mockReturnValue(mockP12Buffer);

      forge.pkcs12.pkcs12FromAsn1.mockReturnValue({
        getBags: jest.fn(() => ({})),
      });
      forge.asn1.fromDer.mockReturnValue('asn1-data');
      forge.util.createBuffer.mockReturnValue('buffer-data');

      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).toBeNull();
    });

    it('returns null when PKCS12 has expired certificate', async () => {
      CertificateLoader._certPaths.identity = '/certs/identity.p12';
      CertificateLoader._identityPassword = 'testpassword';

      fs.readFileSync.mockReturnValue(mockP12Buffer);

      const expiredCert = {
        validity: {
          notAfter: new Date('2020-01-01'),
          notBefore: new Date('2010-01-01'),
        },
        subject: {
          getField: jest.fn().mockReturnValue({ value: 'Expired Cert' }),
        },
      };

      const mockKeyBags = {};
      mockKeyBags[forge.pki.oids.pkcs8ShroudedKeyBag] = [{ key: 'key' }];
      const mockCertBags = {};
      mockCertBags[forge.pki.oids.certBag] = [{ cert: expiredCert }];

      forge.pkcs12.pkcs12FromAsn1.mockReturnValue({
        getBags: jest.fn(({ bagType }) => {
          if (bagType === forge.pki.oids.pkcs8ShroudedKeyBag || bagType === forge.pki.oids.keyBag) {
            return mockKeyBags;
          }
          if (bagType === forge.pki.oids.certBag) {
            return mockCertBags;
          }
          return {};
        }),
      });
      forge.asn1.fromDer.mockReturnValue('asn1-data');
      forge.util.createBuffer.mockReturnValue('buffer-data');

      const cert = await CertificateLoader.loadIdentityCertificate();
      expect(cert).toBeNull();
    });
  });

  describe('_pemToDerBuffer', () => {
    it('extracts DER from PEM format', () => {
      const pem = [
        '-----BEGIN CERTIFICATE-----',
        'dGVzdGNlcnRkYXRh',
        '-----END CERTIFICATE-----',
      ].join('\n');

      const result = CertificateLoader._pemToDerBuffer(pem);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('base64')).toBe('dGVzdGNlcnRkYXRh');
    });

    it('handles PEM with line-wrapped base64 content', () => {
      const pem = [
        '-----BEGIN CERTIFICATE-----',
        'dGVzdGNl',
        'cnRkYXRh',
        '-----END CERTIFICATE-----',
      ].join('\n');

      const result = CertificateLoader._pemToDerBuffer(pem);
      expect(result.toString('base64')).toBe('dGVzdGNlcnRkYXRh');
    });

    it('handles raw base64 (non-PEM) input', () => {
      const result = CertificateLoader._pemToDerBuffer('dGVzdGNlcnRkYXRh');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('base64')).toBe('dGVzdGNlcnRkYXRh');
    });

    it('returns null for invalid base64 input', () => {
      const result = CertificateLoader._pemToDerBuffer('!!!invalid!!!');
      expect(result).toBeNull();
    });
  });

  describe('_bufferToPem', () => {
    it('converts Buffer to PEM format', () => {
      const buf = Buffer.from('dGVzdGNlcnRkYXRh', 'base64');
      const pem = CertificateLoader._bufferToPem(buf);

      expect(pem).toContain('-----BEGIN CERTIFICATE-----');
      expect(pem).toContain('-----END CERTIFICATE-----');
      expect(pem).toContain('dGVzdGNlcnRkYXRh');
    });
  });
});
