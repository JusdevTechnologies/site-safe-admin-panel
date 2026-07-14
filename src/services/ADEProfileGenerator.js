const logger = require('../utils/logger');
const environment = require('../../config/environment');
const { v4: uuidv4 } = require('uuid');
const { PROFILE_DOWNLOAD_MIME_TYPE } = require('../constants');
const {
  ProfileValidator,
  CertificateLoader,
  MDMPayloadBuilder,
  RootCAPayloadBuilder,
  SCEPPayloadBuilder,
  PayloadAssembler,
  ProfileSigner,
  XMLSerializer,
} = require('./profile');

class ADEProfileGenerator {
  async generateMobileconfig(profile, enrollment) {
    const profileUuid = profile.profileUuid || uuidv4();
    logger.info('[ADEProfileGen] ========================================================');
    logger.info('[ADEProfileGen] === GENERATE MOBILECONFIG ===');
    logger.info(`[ADEProfileGen] Profile UUID: ${profileUuid}`);
    logger.info(`[ADEProfileGen] Profile name: ${profile.displayName}`);
    logger.info(`[ADEProfileGen] Profile version: ${profile.version}`);

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

    logger.info(`[ADEProfileGen] Profile identifier: ${identifier}`);
    logger.info(`[ADEProfileGen] Server URL: ${serverUrl}`);
    logger.info(`[ADEProfileGen] Check-in URL: ${checkinUrl}`);
    logger.info(`[ADEProfileGen] Topic: ${topic}`);
    logger.info(`[ADEProfileGen] Organization: ${profileData.organization}`);
    logger.info(`[ADEProfileGen] Organization display name: ${orgDisplayName}`);
    logger.info(`[ADEProfileGen] Supervised: ${profileData.isSupervised}`);
    logger.info(`[ADEProfileGen] Mandatory: ${profileData.isMandatory}`);
    logger.info(`[ADEProfileGen] MDM removable: ${profileData.isMDMRemovable}`);
    logger.info(`[ADEProfileGen] Await device configured: ${profileData.awaitDeviceConfigured}`);
    logger.info(`[ADEProfileGen] Identity cert UUID: ${profileData.identityCertificateUuid}`);
    logger.info(
      `[ADEProfileGen] Skip setup items (${skipItems.length}): ${JSON.stringify(skipItems)}`,
    );
    logger.info(`[ADEProfileGen] Support email: ${profileData.supportEmail || 'not set'}`);
    logger.info(`[ADEProfileGen] Support phone: ${profileData.supportPhone || 'not set'}`);
    logger.info(`[ADEProfileGen] Language: ${profileData.language || 'not set'}`);
    logger.info(`[ADEProfileGen] Region: ${profileData.region || 'not set'}`);
    logger.info(`[ADEProfileGen] Department: ${profileData.department || 'not set'}`);

    logger.info('[ADEProfileGen] Validating profile data...');
    const validateStart = Date.now();
    ProfileValidator.validate(profileData);
    logger.info(`[ADEProfileGen] Validation passed (${Date.now() - validateStart}ms)`);

    const certLoadStart = Date.now();
    const rootCaCerts = await CertificateLoader.loadRootCACertificates();
    logger.info(`[ADEProfileGen] Certificate loading took ${Date.now() - certLoadStart}ms`);

    logger.info(`[ADEProfileGen] Building ${rootCaCerts.length} root CA payload(s)`);
    const rootCaPayloads = rootCaCerts.map((cert) => {
      const payload = RootCAPayloadBuilder.build(cert, identifier);
      logger.info(
        `[ADEProfileGen]   Root CA payload: ${payload.PayloadUUID} — "${cert.displayName}"`,
      );
      return payload;
    });

    logger.info('[ADEProfileGen] Building SCEP payload...');
    const scepBuildStart = Date.now();
    const {
      payload: scepPayload,
      payloadUuid: scepPayloadUuid,
    } = SCEPPayloadBuilder.build({
      identifier,
      url: 'https://kokkenweb.com/scep',
      challenge: enrollment?.challenge || '',
      subject: enrollment?.serial_number || '',
    });
    logger.info(`[ADEProfileGen] SCEP payload built in ${Date.now() - scepBuildStart}ms`);
    logger.info(`[ADEProfileGen] SCEP payload UUID: ${scepPayloadUuid}`);

    logger.info(`[ADEProfileGen] Building MDM payload for topic "${topic}"`);
    const mdmPayload = MDMPayloadBuilder.build({
      identifier,
      serverUrl,
      checkinUrl,
      topic,
      isSupervised: profileData.isSupervised,
      isMandatory: profileData.isMandatory,
      isMDMRemovable: profileData.isMDMRemovable,
      awaitDeviceConfigured: profileData.awaitDeviceConfigured,
      identityPayloadUuid: scepPayloadUuid,
      anchorCerts: rootCaCerts,
    });
    logger.info(`[ADEProfileGen] MDM payload built: UUID=${mdmPayload.PayloadUUID}`);
    logger.info(`[ADEProfileGen] MDM ServerURL: ${mdmPayload.ServerURL}`);
    logger.info(`[ADEProfileGen] MDM CheckInURL: ${mdmPayload.CheckInURL}`);
    logger.info(`[ADEProfileGen] MDM Topic: ${mdmPayload.Topic}`);
    logger.info(`[ADEProfileGen] MDM SignMessage: ${mdmPayload.SignMessage}`);
    logger.info(
      `[ADEProfileGen] MDM IdentityCertificateUUID: ${mdmPayload.IdentityCertificateUUID || 'NOT SET'}`,
    );
    logger.info(
      `[ADEProfileGen] MDM AnchorCertificates: ${mdmPayload.AnchorCertificates ? mdmPayload.AnchorCertificates.length + ' cert(s)' : 'none'}`,
    );

    const payloadCount = rootCaPayloads.length + 1 + 1;
    logger.info(`[ADEProfileGen] Assembling profile (${payloadCount} payloads)...`);
    const assembled = PayloadAssembler.assemble({
      profile: profileData,
      rootCaPayloads,
      scepPayload,
      mdmPayload,
    });

    logger.info(`[ADEProfileGen] Top-level PayloadUUID: ${assembled.PayloadUUID}`);
    logger.info(`[ADEProfileGen] Top-level PayloadIdentifier: ${assembled.PayloadIdentifier}`);
    logger.info(`[ADEProfileGen] Top-level PayloadOrganization: ${assembled.PayloadOrganization}`);
    logger.info(`[ADEProfileGen] TargetDeviceType: ${assembled.TargetDeviceType}`);
    if (assembled.SkipSetupItems) {
      logger.info(`[ADEProfileGen] SkipSetupItems: ${JSON.stringify(assembled.SkipSetupItems)}`);
    }

    logger.info('[ADEProfileGen] Serializing profile to XML...');
    const xmlStart = Date.now();
    const xml = XMLSerializer.serialize(assembled);
    logger.info(`[ADEProfileGen] XML serialization took ${Date.now() - xmlStart}ms`);
    logger.info(`[ADEProfileGen] Raw XML size: ${xml.length} bytes`);
    logger.info(
      `[ADEProfileGen] XML first 200 chars: ${xml.substring(0, 200).replace(/\n/g, '\\n')}`,
    );

    logger.info(`[ADEProfileGen] Signing profile (enabled: ${ProfileSigner._enabled})...`);
    const signStart = Date.now();
    const signed = ProfileSigner.sign(xml);
    logger.info(`[ADEProfileGen] Signing took ${Date.now() - signStart}ms`);
    logger.info(`[ADEProfileGen] Signed: ${signed.signed}`);
    logger.info(`[ADEProfileGen] Final content size: ${signed.content.length} bytes`);
    logger.info(
      `[ADEProfileGen] Final content first 200 chars: ${signed.content.substring(0, 200).replace(/\n/g, '\\n')}`,
    );

    logger.info(
      `[ADEProfileGen] Generated .mobileconfig for ${profileUuid} — ` +
        `${payloadCount} payload(s) (${rootCaPayloads.length} root CA, 1 SCEP, 1 MDM), ` +
        `signed: ${signed.signed}, ` +
        `size: ${signed.content.length} bytes`,
    );
    logger.info('[ADEProfileGen] === END GENERATE MOBILECONFIG ===');
    logger.info('[ADEProfileGen] ========================================================');

    return signed.content;
  }

  getMimeType() {
    return PROFILE_DOWNLOAD_MIME_TYPE;
  }
}

module.exports = new ADEProfileGenerator();
