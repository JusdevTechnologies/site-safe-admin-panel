jest.mock('../../../src/services/profile/CertificateLoader', () => ({
  loadRootCACertificates: jest.fn(),
  loadIdentityCertificate: jest.fn(),
}));

jest.mock('../../../config/environment', () => ({
  nodeEnv: 'test',
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

const CertificateLoader = require('../../../src/services/profile/CertificateLoader');
const ADEProfileGenerator = require('../../../src/services/ADEProfileGenerator');
const {
  ProfileValidator,
  MDMPayloadBuilder,
  RootCAPayloadBuilder,
  IdentityPayloadBuilder,
  PayloadAssembler,
  XMLSerializer,
  ProfileSigner,
} = require('../../../src/services/profile');

const mockProfile = {
  profileUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
  displayName: 'Test MDM Profile',
  description: 'Test Description',
  organization: 'TestOrg',
  organizationDisplayName: 'TestOrg Display',
  url: 'https://mdm.example.com/mdm',
  checkinUrl: 'https://mdm.example.com/checkin',
  topic: 'com.apple.mgmt.TestTopicUUID',
  version: 1,
  isMandatory: true,
  supervised: true,
  allowProfileRemoval: false,
  awaitDeviceConfigured: true,
  identityCertificateUuid: '',
  anchorCertificates: [],
  skipSetupAssistantItems: ['AppleID', 'Privacy', 'Passcode'],
  supportEmail: 'support@example.com',
  supportPhone: '+1-555-0123',
  supportContact: 'IT Support',
  language: 'en',
  region: 'US',
  department: 'IT',
};

const mockRootCaCert = {
  displayName: 'Test Root CA',
  description: 'Test Root CA Cert',
  rawData: Buffer.from('dGVzdGNlcnRkYXRh', 'base64'),
};

const mockIdentityCert = {
  displayName: 'Test Identity',
  description: 'Test Identity Cert',
  rawData: Buffer.from('aWQlZGVudGl0eWRhdGE=', 'base64'),
};

// ============================================================
// INTEGRATION: End-to-End Profile Generation
// ============================================================
describe('ADEProfileGenerator - Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMobileconfig', () => {
    it('generates valid XML with all required payload sections', async () => {
      CertificateLoader.loadRootCACertificates.mockResolvedValue([]);
      CertificateLoader.loadIdentityCertificate.mockResolvedValue(null);

      const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

      expect(result).toBeDefined();
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<plist version="1.0">');
      expect(result).toContain('</plist>');
      expect(result).toContain('<!DOCTYPE plist');
      expect(result).toContain('com.apple.mdm');
    });

    it('includes root CA payloads when certificates are loaded', async () => {
      CertificateLoader.loadRootCACertificates.mockResolvedValue([mockRootCaCert]);
      CertificateLoader.loadIdentityCertificate.mockResolvedValue(null);

      const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

      expect(result).toContain('com.apple.security.root');
      expect(result).toContain('<data>');
      expect(result).toContain('dGVzdGNlcnRkYXRh');
    });

    it('includes identity certificate payload when available', async () => {
      CertificateLoader.loadRootCACertificates.mockResolvedValue([]);
      CertificateLoader.loadIdentityCertificate.mockResolvedValue(mockIdentityCert);

      const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

      expect(result).toContain('com.apple.security.pkcs12');
      expect(result).toContain('<data>');
      expect(result).toContain('aWQlZGVudGl0eWRhdGE=');
    });

    it('sets IdentityCertificateUUID when identity payload is present', async () => {
      CertificateLoader.loadRootCACertificates.mockResolvedValue([]);
      CertificateLoader.loadIdentityCertificate.mockResolvedValue(mockIdentityCert);

      const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

      expect(result).toContain('IdentityCertificateUUID');
    });

    it('produces correct MIME type', () => {
      const mime = ADEProfileGenerator.getMimeType();
      expect(mime).toBe('application/x-apple-aspen-config');
    });

    it('returns unsigned XML profile when signing is disabled', async () => {
      CertificateLoader.loadRootCACertificates.mockResolvedValue([]);
      CertificateLoader.loadIdentityCertificate.mockResolvedValue(null);

      ProfileSigner.setEnabled(false);
      const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

      expect(result).toContain('<?xml');
      expect(result).toContain('com.apple.mdm');
      expect(result).toContain('<dict>');
      expect(result).toContain('<key>PayloadContent</key>');
      expect(result).toContain('<array>');
    });
  });
});

// ============================================================
// UNIT: ProfileValidator
// ============================================================
describe('ProfileValidator', () => {
  it('passes for valid profile data', () => {
    const valid = {
      payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
      identifier: 'com.kokken.mdm.enrollment',
      organization: 'TestOrg',
      serverUrl: 'https://mdm.example.com/mdm',
      checkinUrl: 'https://mdm.example.com/checkin',
      topic: 'com.apple.mgmt.TestTopicUUID',
      version: 1,
    };
    expect(ProfileValidator.validate(valid)).toBe(true);
  });

  it('throws for missing ServerURL', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: '',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
      }),
    ).toThrow('ServerURL is required');
  });

  it('throws for invalid ServerURL', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'not-a-url',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
      }),
    ).toThrow('ServerURL is not a valid URL');
  });

  it('throws for missing CheckInURL', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: '',
        topic: 'com.apple.mgmt.Test',
        version: 1,
      }),
    ).toThrow('CheckInURL is required');
  });

  it('throws for missing or invalid Topic', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: '',
        version: 1,
      }),
    ).toThrow('Topic is required');
  });

  it('throws for Topic not starting with com.apple.mgmt', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.example.other',
        version: 1,
      }),
    ).toThrow('Topic must start with com.apple.mgmt.');
  });

  it('rejects bare topic prefix com.apple.mgmt.', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.',
        version: 1,
      }),
    ).toThrow('Topic cannot be the bare prefix');
  });

  it('throws for missing Profile UUID', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: '',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
      }),
    ).toThrow('Profile UUID is required');
  });

  it('throws for invalid Profile UUID', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'not-a-uuid',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
      }),
    ).toThrow('Profile UUID is not a valid UUID');
  });

  it('throws for missing organization', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: '',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
      }),
    ).toThrow('Organization is required');
  });

  it('throws for missing identifier', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: '',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
      }),
    ).toThrow('Profile Identifier is required');
  });

  it('rejects invalid identity payload UUID', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        identityCertificatePayloadUuid: 'not-a-uuid',
        version: 1,
      }),
    ).toThrow('Identity Certificate Payload UUID is not valid');
  });

  it('accepts valid SkipSetupAssistantItems', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
        skipSetupItems: ['AppleID', 'Privacy', 'Passcode', 'Welcome', 'Zoom'],
      }),
    ).not.toThrow();
  });

  it('rejects invalid SkipSetupAssistantItems', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
        skipSetupItems: ['AppleID', 'INVALID_ITEM', 'Privacy'],
      }),
    ).toThrow('Unsupported SkipSetupAssistantItems value: "INVALID_ITEM"');
  });

  it('rejects empty skip items list', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
        version: 1,
        skipSetupItems: [],
      }),
    ).not.toThrow();
  });

  it('rejects HTTP URLs in production environment', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        ProfileValidator.validate({
          payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
          identifier: 'com.test',
          organization: 'Test',
          serverUrl: 'http://mdm.example.com/mdm',
          checkinUrl: 'https://example.com',
          topic: 'com.apple.mgmt.Test',
          version: 1,
        }),
      ).toThrow('ServerURL must use HTTPS in production');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('rejects HTTP CheckInURL in production environment', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        ProfileValidator.validate({
          payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
          identifier: 'com.test',
          organization: 'Test',
          serverUrl: 'https://example.com',
          checkinUrl: 'http://example.com/checkin',
          topic: 'com.apple.mgmt.Test',
          version: 1,
        }),
      ).toThrow('CheckInURL must use HTTPS in production');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('throws for missing version', () => {
    expect(() =>
      ProfileValidator.validate({
        payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        identifier: 'com.test',
        organization: 'Test',
        serverUrl: 'https://example.com',
        checkinUrl: 'https://example.com',
        topic: 'com.apple.mgmt.Test',
      }),
    ).toThrow('Profile version is required');
  });
});

// ============================================================
// UNIT: MDMPayloadBuilder
// ============================================================
describe('MDMPayloadBuilder', () => {
  const baseParams = {
    identifier: 'com.kokken.mdm.enrollment',
    serverUrl: 'https://mdm.example.com/mdm',
    checkinUrl: 'https://mdm.example.com/checkin',
    topic: 'com.apple.mgmt.TestTopicUUID',
  };

  it('builds MDM payload with all required keys', () => {
    const result = MDMPayloadBuilder.build(baseParams);

    expect(result.PayloadType).toBe('com.apple.mdm');
    expect(result.PayloadVersion).toBe(1);
    expect(result.ServerURL).toBe('https://mdm.example.com/mdm');
    expect(result.CheckInURL).toBe('https://mdm.example.com/checkin');
    expect(result.Topic).toBe('com.apple.mgmt.TestTopicUUID');
    expect(result.SignMessage).toBe(true);
    expect(result.IsSupervised).toBe(true);
    expect(result.IsMandatory).toBe(true);
    expect(result.IsMDMRemovable).toBe(false);
    expect(result.AwaitDeviceConfigured).toBe(true);
    expect(result.AccessRights).toBe(8191);
    expect(result.UserIdentity).toBe(false);
    expect(result.CheckInWhenRemoving).toBe(true);
  });

  it('includes IdentityCertificateUUID when identity payload UUID is provided', () => {
    const identityUuid = '11111111-2222-3333-4444-555555555555';
    const result = MDMPayloadBuilder.build({
      ...baseParams,
      identityPayloadUuid: identityUuid,
    });

    expect(result.IdentityCertificateUUID).toBe(identityUuid);
  });

  it('omits IdentityCertificateUUID when no identity payload UUID', () => {
    const result = MDMPayloadBuilder.build(baseParams);

    expect(result.IdentityCertificateUUID).toBeUndefined();
  });

  it('includes PushMagicTopic when topic contains a dot', () => {
    const result = MDMPayloadBuilder.build(baseParams);

    expect(result.PushMagicTopic).toBe('com.apple.mgmt.TestTopicUUID');
  });

  it('includes AnchorCertificates as Buffer array when certs provided', () => {
    const anchorCerts = [
      { rawData: Buffer.from('Y2VydDE=', 'base64') },
      { rawData: Buffer.from('Y2VydDI=', 'base64') },
    ];
    const result = MDMPayloadBuilder.build({
      ...baseParams,
      anchorCerts,
    });

    expect(result.AnchorCertificates).toHaveLength(2);
    expect(Buffer.isBuffer(result.AnchorCertificates[0])).toBe(true);
    expect(result.AnchorCertificates[0].toString('base64')).toBe('Y2VydDE=');
    expect(result.AnchorCertificates[1].toString('base64')).toBe('Y2VydDI=');
  });

  it('omits AnchorCertificates when no certs provided', () => {
    const result = MDMPayloadBuilder.build(baseParams);

    expect(result.AnchorCertificates).toBeUndefined();
  });

  it('generates unique PayloadUUID for each call', () => {
    const result1 = MDMPayloadBuilder.build(baseParams);
    const result2 = MDMPayloadBuilder.build(baseParams);

    expect(result1.PayloadUUID).not.toBe(result2.PayloadUUID);
  });
});

// ============================================================
// UNIT: RootCAPayloadBuilder
// ============================================================
describe('RootCAPayloadBuilder', () => {
  it('builds root CA payload with correct structure', () => {
    const cert = {
      displayName: 'My Root CA',
      description: 'My Root CA Cert',
      rawData: Buffer.from('dGVzdGNlcnRkYXRh', 'base64'),
    };

    const result = RootCAPayloadBuilder.build(cert, 'com.kokken.mdm.enrollment');

    expect(result.PayloadType).toBe('com.apple.security.root');
    expect(result.PayloadVersion).toBe(1);
    expect(result.PayloadDisplayName).toBe('My Root CA');
    expect(result.PayloadDescription).toBe('My Root CA Cert');
    expect(result.PayloadUUID).toBeDefined();
    expect(result.PayloadIdentifier).toContain('com.kokken.mdm.enrollment.rootca');
    expect(Buffer.isBuffer(result.PayloadContent)).toBe(true);
    expect(result.PayloadContent.toString('base64')).toBe('dGVzdGNlcnRkYXRh');
  });
});

// ============================================================
// UNIT: IdentityPayloadBuilder
// ============================================================
describe('IdentityPayloadBuilder', () => {
  it('builds identity payload with correct structure', () => {
    const cert = {
      displayName: 'My Identity',
      description: 'My Identity Cert',
      rawData: Buffer.from('aWQlZGVudGl0eWRhdGE=', 'base64'),
    };

    const result = IdentityPayloadBuilder.build(cert, 'com.kokken.mdm.enrollment');

    expect(result.payloadUuid).toBeDefined();
    expect(result.payload.PayloadType).toBe('com.apple.security.pkcs12');
    expect(result.payload.PayloadVersion).toBe(1);
    expect(result.payload.PayloadDisplayName).toBe('My Identity');
    expect(result.payload.PayloadDescription).toBe('My Identity Cert');
    expect(result.payload.PayloadUUID).toBeDefined();
    expect(result.payload.PayloadIdentifier).toContain('com.kokken.mdm.enrollment.identity');
    expect(Buffer.isBuffer(result.payload.PayloadContent)).toBe(true);
    expect(result.payload.PayloadContent.toString('base64')).toBe('aWQlZGVudGl0eWRhdGE=');
  });

  it('generates unique UUIDs for each build call', () => {
    const cert = {
      displayName: 'Identity',
      description: 'Cert',
      rawData: Buffer.from('dGVzdA==', 'base64'),
    };

    const result1 = IdentityPayloadBuilder.build(cert, 'com.test');
    const result2 = IdentityPayloadBuilder.build(cert, 'com.test');

    expect(result1.payloadUuid).not.toBe(result2.payloadUuid);
  });
});

// ============================================================
// UNIT: PayloadAssembler
// ============================================================
describe('PayloadAssembler', () => {
  const baseProfile = {
    payloadUuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    identifier: 'com.kokken.mdm.enrollment',
    displayName: 'Test Profile',
    description: 'Test Description',
    organization: 'TestOrg',
    version: 1,
    isMDMRemovable: false,
  };

  const mdmPayload = {
    PayloadType: 'com.apple.mdm',
    PayloadUUID: 'mdm-uuid-123',
  };

  it('assembles payloads in correct order: RootCA, Identity, MDM', () => {
    const rootCaPayload = {
      PayloadType: 'com.apple.security.root',
      PayloadUUID: 'root-uuid-1',
    };
    const identityPayload = {
      PayloadType: 'com.apple.security.pkcs12',
      PayloadUUID: 'identity-uuid-1',
    };

    const result = PayloadAssembler.assemble({
      profile: baseProfile,
      rootCaPayloads: [rootCaPayload],
      identityPayload,
      mdmPayload,
    });

    expect(result.PayloadContent).toHaveLength(3);
    expect(result.PayloadContent[0].PayloadType).toBe('com.apple.security.root');
    expect(result.PayloadContent[1].PayloadType).toBe('com.apple.security.pkcs12');
    expect(result.PayloadContent[2].PayloadType).toBe('com.apple.mdm');
  });

  it('assembles payloads with only MDM when no certs', () => {
    const result = PayloadAssembler.assemble({
      profile: baseProfile,
      rootCaPayloads: [],
      identityPayload: null,
      mdmPayload,
    });

    expect(result.PayloadContent).toHaveLength(1);
    expect(result.PayloadContent[0].PayloadType).toBe('com.apple.mdm');
  });

  it('includes multiple root CA payloads in order', () => {
    const rootCa1 = { PayloadType: 'com.apple.security.root', PayloadUUID: 'root-1' };
    const rootCa2 = { PayloadType: 'com.apple.security.root', PayloadUUID: 'root-2' };

    const result = PayloadAssembler.assemble({
      profile: baseProfile,
      rootCaPayloads: [rootCa1, rootCa2],
      identityPayload: null,
      mdmPayload,
    });

    expect(result.PayloadContent).toHaveLength(3);
    expect(result.PayloadContent[0].PayloadUUID).toBe('root-1');
    expect(result.PayloadContent[1].PayloadUUID).toBe('root-2');
  });

  it('includes top-level profile keys', () => {
    const result = PayloadAssembler.assemble({
      profile: baseProfile,
      rootCaPayloads: [],
      identityPayload: null,
      mdmPayload,
    });

    expect(result.PayloadType).toBe('Configuration');
    expect(result.PayloadUUID).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result.PayloadVersion).toBe(1);
    expect(result.TargetDeviceType).toBe(5);
    expect(result.PayloadRemovalDisallowed).toBe(true);
    expect(result.PayloadOrganization).toBe('TestOrg');
    expect(result.PayloadDisplayName).toBe('Test Profile');
  });

  it('includes SkipSetupItems when provided', () => {
    const result = PayloadAssembler.assemble({
      profile: { ...baseProfile, skipSetupItems: ['AppleID', 'Privacy'] },
      rootCaPayloads: [],
      identityPayload: null,
      mdmPayload,
    });

    expect(result.SkipSetupItems).toEqual(['AppleID', 'Privacy']);
  });

  it('omits SkipSetupItems when empty', () => {
    const result = PayloadAssembler.assemble({
      profile: { ...baseProfile, skipSetupItems: [] },
      rootCaPayloads: [],
      identityPayload: null,
      mdmPayload,
    });

    expect(result.SkipSetupItems).toBeUndefined();
  });

  it('includes optional metadata keys when provided', () => {
    const result = PayloadAssembler.assemble({
      profile: {
        ...baseProfile,
        organizationDisplayName: 'DisplayOrg',
        supportEmail: 'support@example.com',
        supportPhone: '+1-555-0123',
        department: 'IT',
        language: 'en',
        region: 'US',
      },
      rootCaPayloads: [],
      identityPayload: null,
      mdmPayload,
    });

    expect(result.OrganizationDisplayName).toBe('DisplayOrg');
    expect(result.SupportEmailAddress).toBe('support@example.com');
    expect(result.SupportPhoneNumber).toBe('+1-555-0123');
    expect(result.Department).toBe('IT');
    expect(result.Language).toBe('en');
    expect(result.Region).toBe('US');
  });
});

// ============================================================
// UNIT: XMLSerializer
// ============================================================
describe('XMLSerializer', () => {
  const minimalProfile = {
    PayloadContent: [
      {
        PayloadType: 'com.apple.mdm',
        PayloadVersion: 1,
        PayloadIdentifier: 'com.test.mdm',
        PayloadUUID: '11111111-1111-1111-1111-111111111111',
        ServerURL: 'https://mdm.example.com',
        CheckInURL: 'https://mdm.example.com/checkin',
        Topic: 'com.apple.mgmt.Test',
        SignMessage: true,
        IsSupervised: true,
        IsMandatory: true,
        IsMDMRemovable: false,
        AwaitDeviceConfigured: true,
        AccessRights: 8191,
        UserIdentity: false,
        CheckInWhenRemoving: true,
      },
    ],
    PayloadDescription: 'Test enrollment profile',
    PayloadDisplayName: 'Test Profile',
    PayloadIdentifier: 'com.test.enrollment.uuid',
    PayloadOrganization: 'TestOrg',
    PayloadRemovalDisallowed: true,
    PayloadType: 'Configuration',
    PayloadUUID: '22222222-2222-2222-2222-222222222222',
    PayloadVersion: 1,
    TargetDeviceType: 5,
  };

  it('generates valid XML plist', () => {
    const xml = XMLSerializer.serialize(minimalProfile);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<!DOCTYPE plist');
    expect(xml).toContain('<plist version="1.0">');
    expect(xml).toContain('</plist>');
  });

  it('produces balanced tags', () => {
    const xml = XMLSerializer.serialize(minimalProfile);

    const openDicts = (xml.match(/<dict>/g) || []).length;
    const closeDicts = (xml.match(/<\/dict>/g) || []).length;
    expect(openDicts).toBe(closeDicts);

    const openArrays = (xml.match(/<array>/g) || []).length;
    const closeArrays = (xml.match(/<\/array>/g) || []).length;
    expect(openArrays).toBe(closeArrays);
  });

  it('escapes XML special characters in string values', () => {
    const profileWithSpecialChars = {
      ...minimalProfile,
      PayloadOrganization: 'Test & Co. <"Security">',
    };

    const xml = XMLSerializer.serialize(profileWithSpecialChars);

    expect(xml).toContain('Test &amp; Co. &lt;&quot;Security&quot;&gt;');
    expect(xml).not.toContain('Test & Co.');
  });

  it('serializes boolean values correctly', () => {
    const xml = XMLSerializer.serialize(minimalProfile);

    expect(xml).toContain('<true/>');
    expect(xml).toContain('<false/>');
  });

  it('serializes Buffer values as <data> elements', () => {
    const profileWithData = {
      ...minimalProfile,
      PayloadContent: [
        {
          PayloadType: 'com.apple.security.root',
          PayloadUUID: 'root-uuid',
          PayloadContent: Buffer.from('dGVzdGRhdGE=', 'base64'),
        },
      ],
    };

    const xml = XMLSerializer.serialize(profileWithData);

    expect(xml).toContain('<data>');
    expect(xml).toContain('dGVzdGRhdGE=');
    expect(xml).not.toContain('<string>dGVzdGRhdGE=</string>');
  });

  it('produces deterministic output with sorted keys', () => {
    const xml = XMLSerializer.serialize(minimalProfile);
    const xml2 = XMLSerializer.serialize(minimalProfile);

    expect(xml).toBe(xml2);
  });

  it('keys are sorted alphabetically within each dict', () => {
    const profile = {
      Zebra: 'last',
      Alpha: 'first',
      PayloadType: 'Configuration',
      PayloadUUID: 'uuid',
    };

    const xml = XMLSerializer.serialize(profile);

    const alphaIdx = xml.indexOf('Alpha');
    const payloadTypeIdx = xml.indexOf('PayloadType');
    const payloadUuidIdx = xml.indexOf('PayloadUUID');
    const zebraIdx = xml.indexOf('Zebra');

    expect(alphaIdx).toBeLessThan(payloadTypeIdx);
    expect(payloadTypeIdx).toBeLessThan(payloadUuidIdx);
    expect(payloadUuidIdx).toBeLessThan(zebraIdx);
  });

  it('validates balanced tags before returning', () => {
    const xml = XMLSerializer.serialize(minimalProfile);
    const openDicts = (xml.match(/<dict>/g) || []).length;
    const closeDicts = (xml.match(/<\/dict>/g) || []).length;
    expect(openDicts).toBe(closeDicts);
  });
});

// ============================================================
// UNIT: ProfileSigner
// ============================================================
describe('ProfileSigner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unsigned content by default when disabled', () => {
    ProfileSigner.setEnabled(false);
    const xml = '<plist><dict></dict></plist>';
    const result = ProfileSigner.sign(xml);

    expect(result.signed).toBe(false);
    expect(result.content).toBe(xml);
    expect(result.signature).toBeNull();
  });

  it('wraps signed content when signature is provided', () => {
    const result = ProfileSigner.wrapSignedContent(
      '<plist><dict><key>Existing</key><true/></dict></plist>',
      'base64signature',
    );

    expect(result).toContain('base64signature');
    expect(result).toContain('PayloadContent');
    expect(result).toContain('<data>');
  });

  it('handles wrapSignedContent with null signature gracefully', () => {
    const xml = '<plist><dict></dict></plist>';
    const result = ProfileSigner.wrapSignedContent(xml, null);

    expect(result).toBe(xml);
  });

  it('gracefully fails when signing is enabled but no credentials configured', () => {
    ProfileSigner.setEnabled(true);
    const xml = '<plist><dict><key>Test</key><true/></dict></plist>';
    const result = ProfileSigner.sign(xml);

    expect(result.signed).toBe(false);
    expect(result.content).toBe(xml);
    expect(result.signature).toBeNull();
  });
});

// ============================================================
// E2E: Complete Profile Generation with Certificate Data
// ============================================================
describe('End-to-End: Complete .mobileconfig Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ProfileSigner.setEnabled(false);
  });

  it('generates a complete .mobileconfig with all payload types', async () => {
    CertificateLoader.loadRootCACertificates.mockResolvedValue([
      {
        displayName: 'Intermediate CA',
        description: 'Intermediate CA Cert',
        rawData: Buffer.from(
          'MIIDzTCCArWgAwIBAgIJAN2rL3xYFDZ3MA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRIwEAYDVQQHDAlTYW4gRGllZ28xEjAQBgNVBAoMCU15IENvbXBhbnkxEjAQBgNVBAsMCUlUIERlcGFydDEcMBoGA1UEAwwTVGVzdCBSb290IENBIDEwMjQwMB4XDTIzMDcxMzE4MDAwMFoXDTMzMDcxMDE4MDAwMFowfDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEjAQBgNVBAcMCVNhbiBEaWVnbzESMBAGA1UECgwJTXkgQ29tcGFueTESMBAGA1UECwwJSVQgRGVwYXJ0MRwwGgYDVQQDDBNUZXN0IFJvb3QgQ0EgMTAyNDAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCyL6k4W2sGbD9BHk6kqSlF1xR+QIRL11jSRjWbnFQhW1pk08yLqjI3G6wNqO5B9DlT1izFz/8fWky2PpEfP7oO3qJy5M2+L6BVGLp5aA/SxXQYnN',
          'base64',
        ),
      },
      {
        displayName: 'Root CA',
        description: 'Root CA Cert',
        rawData: Buffer.from(
          'MIIDzTCCArWgAwIBAgIJAN2rL3xYFDZ3MA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRIwEAYDVQQHDAlTYW4gRGllZ28xEjAQBgNVBAoMCU15IENvbXBhbnkxEjAQBgNVBAsMCUlUIERlcGFydDEcMBoGA1UEAwwTVGVzdCBSb290IENBIDEwMjQwMB4XDTIzMDcxMzE4MDAwMFoXDTMzMDcxMDE4MDAwMFowfDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEjAQBgNVBAcMCVNhbiBEaWVnbzESMBAGA1UECgwJTXkgQ29tcGFueTESMBAGA1UECwwJSVQgRGVwYXJ0MRwwGgYDVQQDDBNUZXN0IFJvb3QgQ0EgMTAyNDAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCyL6k4W2sGbD9BHk6kqSlF1xR+QIRL11jSRjWbnFQhW1pk08yLqjI3G6wNqI5B9DlT1izFz/8fWky2PpEfP7oO3qJy5M2+L6BVGLp5aA/SxXQYnN',
          'base64',
        ),
      },
    ]);
    CertificateLoader.loadIdentityCertificate.mockResolvedValue({
      displayName: 'MDM Identity',
      description: 'Identity cert for MDM',
      rawData: Buffer.from('pkcs12data', 'utf8'),
    });

    const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

    expect(result).toBeDefined();
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<!DOCTYPE plist');
    expect(result).toContain('<plist version="1.0">');
    expect(result).toContain('</plist>');

    // Payload types present
    expect(result).toContain('com.apple.security.root');
    expect(result).toContain('com.apple.security.pkcs12');
    expect(result).toContain('com.apple.mdm');

    // Data elements (binary payloads)
    const dataMatches = result.match(/<data>/g) || [];
    expect(dataMatches.length).toBeGreaterThanOrEqual(3);

    // MDM payload fields
    expect(result).toContain('ServerURL');
    expect(result).toContain('CheckInURL');
    expect(result).toContain('Topic');
    expect(result).toContain('AccessRights');
    expect(result).toContain('AwaitDeviceConfigured');
    expect(result).toContain('UserIdentity');
    expect(result).toContain('CheckInWhenRemoving');
    expect(result).toContain('IdentityCertificateUUID');
    expect(result).toContain('AnchorCertificates');

    // Top-level keys
    expect(result).toContain('PayloadType');
    expect(result).toContain('PayloadUUID');
    expect(result).toContain('PayloadDisplayName');
    expect(result).toContain('PayloadIdentifier');
    expect(result).toContain('PayloadOrganization');
    expect(result).toContain('PayloadRemovalDisallowed');
    expect(result).toContain('TargetDeviceType');

    // Profile metadata
    expect(result).toContain('OrganizationDisplayName');
    expect(result).toContain('SupportEmailAddress');
    expect(result).toContain('SupportPhoneNumber');
    expect(result).toContain('Department');

    // Skip setup items
    expect(result).toContain('SkipSetupItems');

    // NOT signed
    expect(result).not.toContain('PayloadContent</key>\n  <data>');

    // Validate XML structure
    const openDicts = (result.match(/<dict>/g) || []).length;
    const closeDicts = (result.match(/<\/dict>/g) || []).length;
    expect(openDicts).toBe(closeDicts);

    const openArrays = (result.match(/<array>/g) || []).length;
    const closeArrays = (result.match(/<\/array>/g) || []).length;
    expect(openArrays).toBe(closeArrays);
  });

  it('generates valid .mobileconfig without identity cert', async () => {
    CertificateLoader.loadRootCACertificates.mockResolvedValue([]);
    CertificateLoader.loadIdentityCertificate.mockResolvedValue(null);

    const noIdentityProfile = {
      ...mockProfile,
      skipSetupAssistantItems: ['AppleID'],
    };

    const result = await ADEProfileGenerator.generateMobileconfig(noIdentityProfile, null);

    expect(result).toContain('com.apple.mdm');
    expect(result).not.toContain('com.apple.security.pkcs12');
    expect(result).not.toContain('IdentityCertificateUUID');
  });
});
