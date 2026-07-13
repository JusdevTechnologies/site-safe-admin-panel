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
      TargetDeviceType: 5,
    };

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

    return assembled;
  }
}

module.exports = new PayloadAssembler();
