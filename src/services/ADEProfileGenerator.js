const logger = require('../utils/logger');
const environment = require('../../config/environment');
const { v4: uuidv4 } = require('uuid');
const { PROFILE_DOWNLOAD_MIME_TYPE } = require('../constants');
const {
  ProfileValidator,
  CertificateLoader,
  MDMPayloadBuilder,
  RootCAPayloadBuilder,
  IdentityPayloadBuilder,
  PayloadAssembler,
  ProfileSigner,
  XMLSerializer,
} = require('./profile');

class ADEProfileGenerator {
  async generateMobileconfig(profile, _enrollment) {
    logger.info(`[ADEProfileGen] Generating .mobileconfig for profile ${profile.profileUuid}`);

    const payloadUuid = profile.profileUuid || uuidv4();
    const identifier = environment.ade.profileIdentifier;
    const orgDisplayName = profile.organizationDisplayName || profile.organization;
    const checkinUrl = profile.checkinUrl || environment.ade.checkinUrl || `${profile.url}/checkin`;
    const serverUrl = profile.url;
    const topic = profile.topic || environment.ade.topic;
    const skipItems = profile.skipSetupAssistantItems || [];

    const profileData = {
      payloadUuid,
      identifier,
      displayName: profile.displayName,
      description: profile.description || `MDM Enrollment for ${profile.organization}`,
      organization: profile.organization,
      organizationDisplayName: orgDisplayName,
      version: profile.version || 1,
      serverUrl,
      checkinUrl,
      topic,
      isSupervised: profile.supervised !== false,
      isMandatory: profile.isMandatory !== false,
      isMDMRemovable: profile.allowProfileRemoval === true,
      awaitDeviceConfigured: profile.awaitDeviceConfigured !== false,
      identityCertificateUuid: profile.identityCertificateUuid || '',
      anchorCertificates: profile.anchorCertificates || [],
      skipSetupItems: skipItems,
      supportEmail: profile.supportEmail || environment.ade.supportEmail,
      supportPhone: profile.supportPhone || environment.ade.supportPhone,
      supportContact: profile.supportContact || environment.ade.supportContact,
      language: profile.language || environment.ade.language,
      region: profile.region || environment.ade.region,
      department: profile.department || environment.ade.department,
    };

    ProfileValidator.validate(profileData);

    const rootCaCerts = await CertificateLoader.loadRootCACertificates();
    const identityCerts = await CertificateLoader.loadIdentityCertificate();

    const rootCaPayloads = rootCaCerts.map((cert) => RootCAPayloadBuilder.build(cert, identifier));

    let identityPayload = null;
    let identityPayloadUuid = null;

    if (identityCerts) {
      const result = IdentityPayloadBuilder.build(identityCerts, identifier);
      identityPayload = result.payload;
      identityPayloadUuid = result.payloadUuid;
    }

    const mdmPayload = MDMPayloadBuilder.build({
      identifier,
      serverUrl,
      checkinUrl,
      topic,
      isSupervised: profileData.isSupervised,
      isMandatory: profileData.isMandatory,
      isMDMRemovable: profileData.isMDMRemovable,
      awaitDeviceConfigured: profileData.awaitDeviceConfigured,
      identityPayloadUuid,
      anchorCerts: rootCaCerts,
    });

    const assembled = PayloadAssembler.assemble({
      profile: profileData,
      rootCaPayloads,
      identityPayload,
      mdmPayload,
    });

    const xml = XMLSerializer.serialize(assembled);

    const signed = ProfileSigner.sign(xml);

    logger.info(
      `[ADEProfileGen] Generated .mobileconfig for ${profile.profileUuid} (${rootCaPayloads.length} root CA, ${identityPayload ? 1 : 0} identity payloads)`,
    );

    return signed.content;
  }

  getMimeType() {
    return PROFILE_DOWNLOAD_MIME_TYPE;
  }
}

module.exports = new ADEProfileGenerator();
