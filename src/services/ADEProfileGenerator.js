const logger = require('../utils/logger');
const environment = require('../../config/environment');
const { v4: uuidv4 } = require('uuid');
const { PROFILE_DOWNLOAD_MIME_TYPE } = require('../constants');

class ADEProfileGenerator {
  generateMobileconfig(profile, _enrollment) {
    logger.info(`[ADEProfileGen] Generating .mobileconfig for profile ${profile.profileUuid}`);

    const payloadUuid = profile.profileUuid || uuidv4();
    const identifier = environment.ade.profileIdentifier;
    const orgDisplayName = profile.organizationDisplayName || profile.organization;
    const checkinUrl = profile.checkinUrl || environment.ade.checkinUrl || `${profile.url}/checkin`;
    const serverUrl = profile.url;
    const topic = profile.topic || environment.ade.topic;
    const skipItems = profile.skipSetupAssistantItems || [];
    const anchorCerts = profile.anchorCertificates || [];

    const xml = this._buildPlistXml({
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
      anchorCertificates: anchorCerts,
      skipSetupItems: skipItems,
      supportEmail: profile.supportEmail || environment.ade.supportEmail,
      supportPhone: profile.supportPhone || environment.ade.supportPhone,
      supportContact: profile.supportContact || environment.ade.supportContact,
      language: profile.language || environment.ade.language,
      region: profile.region || environment.ade.region,
      department: profile.department || environment.ade.department,
    });

    return xml;
  }

  _buildPlistXml({
    payloadUuid,
    identifier,
    displayName,
    description,
    organization,
    organizationDisplayName,
    version,
    serverUrl,
    checkinUrl,
    topic,
    isSupervised,
    isMandatory,
    isMDMRemovable,
    awaitDeviceConfigured,
    identityCertificateUuid,
    _anchorCertificates,
    _skipSetupItems,
    supportEmail,
    supportPhone,
    _supportContact,
    language,
    region,
    department,
  }) {
    const mdmPayload = this._buildMdmPayloadDict({
      payloadUuid,
      identifier,
      serverUrl,
      checkinUrl,
      topic,
      isSupervised,
      isMandatory,
      isMDMRemovable,
      awaitDeviceConfigured,
      identityCertificateUuid,
    });

    const profile = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>PayloadContent</key>',
      '  <array>',
      mdmPayload,
      '  </array>',
      '  <key>PayloadDescription</key>',
      `  <string>${this._escapeXml(description)}</string>`,
      '  <key>PayloadDisplayName</key>',
      `  <string>${this._escapeXml(displayName)}</string>`,
      '  <key>PayloadIdentifier</key>',
      `  <string>${this._escapeXml(identifier)}.${payloadUuid}</string>`,
      '  <key>PayloadOrganization</key>',
      `  <string>${this._escapeXml(organization)}</string>`,
      '  <key>PayloadRemovalDisallowed</key>',
      `  <${isMDMRemovable ? 'false' : 'true'}/>`,
      '  <key>PayloadType</key>',
      '  <string>Configuration</string>',
      '  <key>PayloadUUID</key>',
      `  <string>${payloadUuid}</string>`,
      '  <key>PayloadVersion</key>',
      `  <integer>${version}</integer>`,
      '  <key>TargetDeviceType</key>',
      '  <integer>5</integer>',
    ];

    if (organizationDisplayName) {
      profile.push('  <key>OrganizationDisplayName</key>');
      profile.push(`  <string>${this._escapeXml(organizationDisplayName)}</string>`);
    }

    if (supportEmail) {
      profile.push('  <key>SupportEmailAddress</key>');
      profile.push(`  <string>${this._escapeXml(supportEmail)}</string>`);
    }

    if (supportPhone) {
      profile.push('  <key>SupportPhoneNumber</key>');
      profile.push(`  <string>${this._escapeXml(supportPhone)}</string>`);
    }

    if (department) {
      profile.push('  <key>Department</key>');
      profile.push(`  <string>${this._escapeXml(department)}</string>`);
    }

    if (language) {
      profile.push('  <key>Language</key>');
      profile.push(`  <string>${this._escapeXml(language)}</string>`);
    }

    if (region) {
      profile.push('  <key>Region</key>');
      profile.push(`  <string>${this._escapeXml(region)}</string>`);
    }

    profile.push('</dict>');
    profile.push('</plist>');

    return profile.join('\n');
  }

  _buildMdmPayloadDict({
    payloadUuid,
    identifier,
    serverUrl,
    checkinUrl,
    topic,
    isSupervised,
    isMandatory,
    isMDMRemovable,
    awaitDeviceConfigured,
    identityCertificateUuid,
  }) {
    const lines = [
      '    <dict>',
      '      <key>PayloadType</key>',
      '      <string>com.apple.mdm</string>',
      '      <key>PayloadVersion</key>',
      '      <integer>1</integer>',
      '      <key>PayloadIdentifier</key>',
      `      <string>${this._escapeXml(identifier)}.mdm.${payloadUuid}</string>`,
      '      <key>PayloadUUID</key>',
      `      <string>${uuidv4()}</string>`,
      '      <key>PayloadDisplayName</key>',
      '      <string>MDM Profile</string>',
      '      <key>PayloadDescription</key>',
      '      <string>Enables Mobile Device Management</string>',
      '      <key>ServerURL</key>',
      `      <string>${this._escapeXml(serverUrl)}</string>`,
      '      <key>CheckInURL</key>',
      `      <string>${this._escapeXml(checkinUrl)}</string>`,
      '      <key>Topic</key>',
      `      <string>${this._escapeXml(topic)}</string>`,
      '      <key>SignMessage</key>',
      '      <true/>',
      '      <key>IsSupervised</key>',
      `      <${isSupervised ? 'true' : 'false'}/>`,
      '      <key>IsMandatory</key>',
      `      <${isMandatory ? 'true' : 'false'}/>`,
      '      <key>IsMDMRemovable</key>',
      `      <${isMDMRemovable ? 'true' : 'false'}/>`,
      '      <key>AwaitDeviceConfigured</key>',
      `      <${awaitDeviceConfigured ? 'true' : 'false'}/>`,
    ];

    if (identityCertificateUuid) {
      lines.push('      <key>IdentityCertificateUUID</key>');
      lines.push(`      <string>${this._escapeXml(identityCertificateUuid)}</string>`);
    }

    if (topic && topic.includes('.')) {
      lines.push('      <key>PushMagicTopic</key>');
      lines.push(`      <string>${this._escapeXml(topic)}</string>`);
    }

    lines.push('      <key>AccessRights</key>');
    lines.push('      <integer>8191</integer>');
    lines.push('      <key>UserIdentity</key>');
    lines.push('      <false/>');
    lines.push('      <key>CheckInWhenRemoving</key>');
    lines.push('      <true/>');

    lines.push('    </dict>');

    return lines.join('\n');
  }

  getMimeType() {
    return PROFILE_DOWNLOAD_MIME_TYPE;
  }

  _escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = new ADEProfileGenerator();
