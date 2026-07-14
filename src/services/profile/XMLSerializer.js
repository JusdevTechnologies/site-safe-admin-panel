const logger = require('../../utils/logger');

class XMLSerializer {
  serialize(profileDict) {
    const buildStart = Date.now();
    const xml = this._buildPlistXml(profileDict);
    const buildTime = Date.now() - buildStart;
    logger.info(`[XMLSerializer] XML built in ${buildTime}ms (${xml.length} bytes raw)`);

    const validateStart = Date.now();
    this._validate(xml);
    logger.info(`[XMLSerializer] XML validation passed (${Date.now() - validateStart}ms)`);

    const dictCount = (xml.match(/<dict>/g) || []).length;
    const arrayCount = (xml.match(/<array>/g) || []).length;
    const keyCount = (xml.match(/<key>/g) || []).length;
    logger.info(
      `[XMLSerializer] XML stats: ${dictCount} dict(s), ${arrayCount} array(s), ${keyCount} key(s)`,
    );

    return xml;
  }

  _buildPlistXml(dict) {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      this._buildDict(dict, 0),
      '</plist>',
    ];

    return lines.join('\n');
  }

  _buildDict(dict, depth) {
    const indent = '  '.repeat(depth + 1);
    const lines = ['<dict>'];

    const keys = Object.keys(dict).sort();

    for (const key of keys) {
      const value = dict[key];
      lines.push(`${indent}<key>${this._escapeXml(key)}</key>`);
      lines.push(this._serializeValue(value, depth + 1, key));
    }

    lines.push(`${'  '.repeat(depth)}</dict>`);
    return lines.join('\n');
  }

  _serializeValue(value, depth, key) {
    const indent = '  '.repeat(depth + 1);

    if (value === null || value === undefined) {
      return `${indent}<string></string>`;
    }

    if (typeof value === 'boolean') {
      return `${indent}<${value ? 'true' : 'false'}/>`;
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return `${indent}<integer>${value}</integer>`;
      }
      return `${indent}<real>${value}</real>`;
    }

    if (typeof value === 'string') {
      return `${indent}<string>${this._escapeXml(value)}</string>`;
    }

    if (Buffer.isBuffer(value)) {
      return `${indent}<data>${value.toString('base64')}</data>`;
    }

    if (Array.isArray(value)) {
      return this._buildArray(value, depth);
    }

    if (typeof value === 'object') {
      return this._buildDict(value, depth);
    }

    return `${indent}<string>${this._escapeXml(String(value))}</string>`;
  }

  _buildArray(arr, depth) {
    const indent = '  '.repeat(depth + 1);
    const lines = ['<array>'];

    for (const item of arr) {
      lines.push(this._serializeValue(item, depth + 1));
    }

    lines.push(`${'  '.repeat(depth)}</array>`);
    return lines.join('\n');
  }

  _validate(xml) {
    if (!xml || xml.length === 0) {
      throw new Error('Generated XML is empty');
    }

    if (!xml.startsWith('<?xml')) {
      throw new Error('Generated XML missing XML declaration');
    }

    if (!xml.includes('<plist')) {
      throw new Error('Generated XML missing plist element');
    }

    if (!xml.includes('</plist>')) {
      throw new Error('Generated XML missing plist closing tag');
    }

    const openDicts = (xml.match(/<dict>/g) || []).length;
    const closeDicts = (xml.match(/<\/dict>/g) || []).length;
    if (openDicts !== closeDicts) {
      throw new Error(
        `Generated XML has mismatched dict tags: ${openDicts} opening, ${closeDicts} closing`,
      );
    }

    const openArrays = (xml.match(/<array>/g) || []).length;
    const closeArrays = (xml.match(/<\/array>/g) || []).length;
    if (openArrays !== closeArrays) {
      throw new Error(
        `Generated XML has mismatched array tags: ${openArrays} opening, ${closeArrays} closing`,
      );
    }

    logger.debug('[XMLSerializer] XML validation passed');
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

module.exports = new XMLSerializer();
