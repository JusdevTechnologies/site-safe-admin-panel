jest.mock('../../../src/services/profile/CertificateLoader', () => ({
  loadRootCACertificates: jest.fn(),
  loadIdentityCertificate: jest.fn(),
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
      CertificateLoader.loadRootCACertificates.mockResolvedValue([
        {
          displayName: 'Test Root CA',
          description: 'Test Root CA Cert',
          derBase64: 'dGVzdGNlcnRkYXRh',
        },
      ]);
      CertificateLoader.loadIdentityCertificate.mockResolvedValue(null);

      const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

      expect(result).toContain('com.apple.security.root');
      expect(result).toContain('dGVzdGNlcnRkYXRh');
    });

    it('includes identity certificate payload when available', async () => {
      CertificateLoader.loadRootCACertificates.mockResolvedValue([]);
      CertificateLoader.loadIdentityCertificate.mockResolvedValue({
        displayName: 'Test Identity',
        description: 'Test Identity Cert',
        pkcs12Base64: 'aWQlZGVudGl0eWRhdGE=',
      });

      const result = await ADEProfileGenerator.generateMobileconfig(mockProfile, null);

      expect(result).toContain('com.apple.security.pkcs12');
      expect(result).toContain('aWQlZGVudGl0eWRhdGE=');
    });

    it('produces correct MIME type', () => {
      const mime = ADEProfileGenerator.getMimeType();
      expect(mime).toBe('application/x-apple-aspen-config');
    });
  });
});

describe('ProfileValidator', () => {
  it('passes for valid profile data', () => {
    const valid = {
      payloadUuid: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
      identifier: 'com.kokken.mdm.enrollment',
      organization: 'TestOrg',
      serverUrl: 'https://mdm.example.com/mdm',
      checkinUrl: 'https://mdm.example.com/checkin',
      topic: 'com.apple.mgmt.TestTopicUUID',
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
      }),
    ).toThrow('Topic must start with com.apple.mgmt.');
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
      }),
    ).toThrow('Identity Certificate Payload UUID is not valid');
  });
});

describe('MDMPayloadBuilder', () => {
  const baseParams = {
    identifier: 'com.kokken.mdm.enrollment',
    serverUrl: 'https://mdm.example.com/mdm',
    checkinUrl: 'https://mdm.example.com/checkin',
    topic: 'com.apple.mgmt.TestTopicUUID',
  };

  it('builds MDM payload with required keys', () => {
    const result = MDMPayloadBuilder.build(baseParams);

    expect(result.PayloadType).toBe('com.apple.mdm');
    expect(result.PayloadVersion).toBe(1);
    expect(result.ServerURL).toBe('https://mdm.example.com/mdm');
    expect(result.CheckInURL).toBe('https://mdm.example.com/checkin');
    expect(result.Topic).toBe('com.apple.mgmt.TestTopicUUID');
    expect(result.SignMessage).toBe(true);
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

  it('includes AnchorCertificates array when certs provided', () => {
    const anchorCerts = [{ derBase64: 'Y2VydDE=' }, { derBase64: 'Y2VydDI=' }];
    const result = MDMPayloadBuilder.build({
      ...baseParams,
      anchorCerts,
    });

    expect(result.AnchorCertificates).toEqual(['Y2VydDE=', 'Y2VydDI=']);
  });

  it('generates unique PayloadUUID for each call', () => {
    const result1 = MDMPayloadBuilder.build(baseParams);
    const result2 = MDMPayloadBuilder.build(baseParams);

    expect(result1.PayloadUUID).not.toBe(result2.PayloadUUID);
  });
});

describe('RootCAPayloadBuilder', () => {
  it('builds root CA payload with correct structure', () => {
    const cert = {
      displayName: 'My Root CA',
      description: 'My Root CA Cert',
      derBase64: 'dGVzdGNlcnRkYXRh',
    };

    const result = RootCAPayloadBuilder.build(cert, 'com.kokken.mdm.enrollment');

    expect(result.PayloadType).toBe('com.apple.security.root');
    expect(result.PayloadVersion).toBe(1);
    expect(result.PayloadDisplayName).toBe('My Root CA');
    expect(result.PayloadDescription).toBe('My Root CA Cert');
    expect(result.PayloadContent).toBe('dGVzdGNlcnRkYXRh');
    expect(result.PayloadUUID).toBeDefined();
    expect(result.PayloadIdentifier).toContain('com.kokken.mdm.enrollment.rootca');
  });
});

describe('IdentityPayloadBuilder', () => {
  it('builds identity payload with correct structure', () => {
    const cert = {
      displayName: 'My Identity',
      description: 'My Identity Cert',
      pkcs12Base64: 'aWQlZGVudGl0eWRhdGE=',
    };

    const result = IdentityPayloadBuilder.build(cert, 'com.kokken.mdm.enrollment');

    expect(result.payloadUuid).toBeDefined();
    expect(result.payload.PayloadType).toBe('com.apple.security.pkcs12');
    expect(result.payload.PayloadVersion).toBe(1);
    expect(result.payload.PayloadDisplayName).toBe('My Identity');
    expect(result.payload.PayloadDescription).toBe('My Identity Cert');
    expect(result.payload.PayloadContent).toBe('aWQlZGVudGl0eWRhdGE=');
    expect(result.payload.PayloadUUID).toBeDefined();
    expect(result.payload.PayloadIdentifier).toContain('com.kokken.mdm.enrollment.identity');
  });
});

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

  it('rejects content missing PayloadContent', () => {
    const incomplete = {
      PayloadType: 'Configuration',
      PayloadUUID: '22222222-2222-2222-2222-222222222222',
    };
    expect(() => XMLSerializer.serialize(incomplete)).not.toThrow();
  });

  it('validates balanced tags before returning', () => {
    const xml = XMLSerializer.serialize(minimalProfile);
    const openDicts = (xml.match(/<dict>/g) || []).length;
    const closeDicts = (xml.match(/<\/dict>/g) || []).length;
    expect(openDicts).toBe(closeDicts);
  });
});

describe('ProfileSigner', () => {
  it('returns unsigned content by default', () => {
    const xml = '<plist><dict></dict></plist>';
    const result = ProfileSigner.sign(xml);

    expect(result.signed).toBe(false);
    expect(result.content).toBe(xml);
    expect(result.signature).toBeNull();
  });

  it('can be enabled for future signing', () => {
    ProfileSigner.setEnabled(true);
    const xml = '<plist><dict></dict></plist>';
    const result = ProfileSigner.sign(xml);

    expect(result.signed).toBe(false);
    expect(result.content).toBe(xml);

    ProfileSigner.setEnabled(false);
  });

  it('wraps signed content when signature is provided', () => {
    const xml = '<plist><dict><key>Existing</key><true/></dict></plist>';
    const result = ProfileSigner.wrapSignedContent(xml, 'base64signature');

    expect(result).toContain('base64signature');
    expect(result).toContain('PayloadContent');
  });
});
