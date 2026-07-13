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
    const profileUuid = profile.profileUuid || uuidv4();
    logger.info(`[ADEProfileGen] Starting .mobileconfig generation for profile ${profileUuid}`);

    const identifier = environment.ade.profileIdentifier;
    const orgDisplayName = profile.organizationDisplayName || profile.organization;
    const checkinUrl = profile.checkinUrl || environment.ade.checkinUrl || `${profile.url}/checkin`;
    const serverUrl = profile.url;
    const topic = profile.topic || environment.ade.topic;
    const skipItems = profile.skipSetupAssistantItems || [];

    const profileData = {
      payloadUuid: profileUuid,
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

    logger.debug(`[ADEProfileGen] Validating profile data for ${profileUuid}`);
    ProfileValidator.validate(profileData);
    logger.info(`[ADEProfileGen] Profile data validated successfully for ${profileUuid}`);

    const rootCaCerts = await CertificateLoader.loadRootCACertificates();
    const identityCerts = await CertificateLoader.loadIdentityCertificate();

    logger.debug(`[ADEProfileGen] Building ${rootCaCerts.length} root CA payload(s)`);
    const rootCaPayloads = rootCaCerts.map((cert) => RootCAPayloadBuilder.build(cert, identifier));

    let identityPayload = null;
    let identityPayloadUuid = null;

    if (identityCerts) {
      const result = IdentityPayloadBuilder.build(identityCerts, identifier);
      identityPayload = result.payload;
      identityPayloadUuid = result.payloadUuid;
      logger.info(`[ADEProfileGen] Identity payload UUID ${identityPayloadUuid} linked to MDM payload`);
    } else {
      logger.debug('[ADEProfileGen] No identity certificate — MDM payload will not include IdentityCertificateUUID');
    }

    logger.debug(`[ADEProfileGen] Building MDM payload for topic "${topic}"`);
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

    logger.debug(`[ADEProfileGen] Assembling profile with ${rootCaPayloads.length + (identityPayload ? 1 : 0) + 1} payload(s)`);
    const assembled = PayloadAssembler.assemble({
      profile: profileData,
      rootCaPayloads,
      identityPayload,
      mdmPayload,
    });

    logger.debug(`[ADEProfileGen] Serializing profile to XML`);
    const xml = XMLSerializer.serialize(assembled);

    logger.info(`[ADEProfileGen] Signing ${ProfileSigner._enabled ? 'enabled' : 'disabled'}`);
    const signed = ProfileSigner.sign(xml);

    const payloadCount = rootCaPayloads.length + (identityPayload ? 1 : 0) + 1;
    logger.info(
      `[ADEProfileGen] Generated .mobileconfig for ${profileUuid} — ` +
        `${payloadCount} payload(s) (${rootCaPayloads.length} root CA, ` +
        `${identityPayload ? 1 : 0} identity, 1 MDM), ` +
        `signed: ${signed.signed}, ` +
        `size: ${signed.content.length} bytes`,
    );

    return signed.content;
  }

  getMimeType() {
    return PROFILE_DOWNLOAD_MIME_TYPE;
  }
}

module.exports = new ADEProfileGenerator();
