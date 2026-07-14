const logger = require('../../utils/logger');

class PayloadAssembler {
  assemble({ profile, rootCaPayloads = [], identityPayload = null, mdmPayload }) {
    const payloadContent = [];

    if (rootCaPayloads.length > 0) {
      for (const certPayload of rootCaPayloads) {
        payloadContent.push(certPayload);
      }
    }

    if (identityPayload) {
      payloadContent.push(identityPayload);
    }

    payloadContent.push(mdmPayload);

    const assembled = {
      PayloadContent: payloadContent,
      PayloadDescription: profile.description || `MDM Enrollment for ${profile.organization}`,
      PayloadDisplayName: profile.displayName,
      PayloadIdentifier: `${profile.identifier}.${profile.payloadUuid}`,
      PayloadOrganization: profile.organization,
      PayloadRemovalDisallowed: !profile.isMDMRemovable,
      PayloadType: 'Configuration',
      PayloadUUID: profile.payloadUuid,
      PayloadVersion: profile.version,
    };

    if (profile.targetDeviceType !== undefined && profile.targetDeviceType !== null) {
      assembled.TargetDeviceType = profile.targetDeviceType;
    }

    if (profile.organizationDisplayName) {
      assembled.OrganizationDisplayName = profile.organizationDisplayName;
    }

    if (profile.supportEmail) {
      assembled.SupportEmailAddress = profile.supportEmail;
    }

    if (profile.supportPhone) {
      assembled.SupportPhoneNumber = profile.supportPhone;
    }

    if (profile.department) {
      assembled.Department = profile.department;
    }

    if (profile.language) {
      assembled.Language = profile.language;
    }

    if (profile.region) {
      assembled.Region = profile.region;
    }

    if (profile.skipSetupItems && profile.skipSetupItems.length > 0) {
      assembled.SkipSetupItems = profile.skipSetupItems;
    }

    logger.info(`[PayloadAssembler] Assembled profile with ${payloadContent.length} payload(s)`);
    logger.info(`[PayloadAssembler]   PayloadUUID: ${assembled.PayloadUUID}`);
    logger.info(`[PayloadAssembler]   PayloadIdentifier: ${assembled.PayloadIdentifier}`);
    logger.info(`[PayloadAssembler]   PayloadDisplayName: ${assembled.PayloadDisplayName}`);
    logger.info(`[PayloadAssembler]   PayloadOrganization: ${assembled.PayloadOrganization}`);
    logger.info(`[PayloadAssembler]   PayloadType: ${assembled.PayloadType}`);
    logger.info(`[PayloadAssembler]   PayloadVersion: ${assembled.PayloadVersion}`);
    logger.info(
      `[PayloadAssembler]   PayloadRemovalDisallowed: ${assembled.PayloadRemovalDisallowed}`,
    );
    if (assembled.OrganizationDisplayName)
      logger.info(
        `[PayloadAssembler]   OrganizationDisplayName: ${assembled.OrganizationDisplayName}`,
      );
    if (assembled.SupportEmailAddress)
      logger.info(`[PayloadAssembler]   SupportEmailAddress: ${assembled.SupportEmailAddress}`);
    if (assembled.SupportPhoneNumber)
      logger.info(`[PayloadAssembler]   SupportPhoneNumber: ${assembled.SupportPhoneNumber}`);
    if (assembled.Department)
      logger.info(`[PayloadAssembler]   Department: ${assembled.Department}`);
    if (assembled.Language) logger.info(`[PayloadAssembler]   Language: ${assembled.Language}`);
    if (assembled.Region) logger.info(`[PayloadAssembler]   Region: ${assembled.Region}`);
    if (assembled.SkipSetupItems)
      logger.info(
        `[PayloadAssembler]   SkipSetupItems: ${JSON.stringify(assembled.SkipSetupItems)}`,
      );

    return assembled;
  }
}

module.exports = new PayloadAssembler();
