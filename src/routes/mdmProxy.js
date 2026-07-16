const express = require('express');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const environment = require('../../config/environment');

const router = express.Router();

let mdmSigningKey = null;
let mdmSigningCert = null;

const NANO_URL = () => `${environment.nanomdm.baseUrl.replace(/\/+$/, '')}`;
const MDM_TOPIC = environment.ade.topic || '';

function loadSigningIdentity() {
  const certPath = environment.ade.identityCertPath;
  const password = environment.ade.identityCertPassword;
  if (!certPath || !password) return;
  try {
    const p12Buffer = fs.readFileSync(path.resolve(certPath));
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    const keyBag =
      (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ] || [])[0] ||
      (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];
    if (!keyBag) throw new Error('No private key in PKCS#12');
    const certList = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    if (certList.length === 0) throw new Error('No certificate in PKCS#12');
    mdmSigningKey = keyBag.key;
    mdmSigningCert = certList[0].cert;
    logger.info(
      `[MDM Proxy] Signing identity loaded: CN=${mdmSigningCert.subject.getField('CN')?.value}`,
    );
  } catch (e) {
    logger.error(`[MDM Proxy] Failed to load signing identity: ${e.message}`);
  }
}

loadSigningIdentity();

function extractPlistValue(xml, key) {
  const re = new RegExp(`<key>\\s*${key}\\s*<\\/key>\\s*<string>\\s*([^<]+)\\s*<\\/string>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function describeAsn1(obj, depth) {
  if (!obj || depth > 5) return '';
  const indent = '  '.repeat(depth);
  let s = `${indent}tagClass=${obj.tagClass} type=${obj.type} constructed=${obj.constructed}`;
  if (obj.value !== null && obj.value !== undefined) {
    if (typeof obj.value === 'string') {
      s += ` value="${obj.value.length > 40 ? obj.value.substring(0, 40) + '...' : obj.value}"`;
    } else if (Array.isArray(obj.value)) {
      s += ` values=[${obj.value.length}]`;
      for (const v of obj.value) s += '\n' + describeAsn1(v, depth + 1);
    }
  }
  return s;
}

function walkAsn1(obj, targetTagClass, targetType, depth) {
  if (!obj || depth > 8) return null;
  if (obj.tagClass === targetTagClass && obj.type === targetType) return obj;
  if (Array.isArray(obj.value)) {
    for (const v of obj.value) {
      const r = walkAsn1(v, targetTagClass, targetType, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function unwrapPkcs7(rawBody) {
  try {
    const bodyStr = rawBody.toString('binary');
    const buf = forge.util.createBuffer(bodyStr);
    const contentInfo = forge.asn1.fromDer(buf);

    // ContentInfo: SEQUENCE { contentType OID, content [0] EXPLICIT }
    if (
      !contentInfo.constructed ||
      !Array.isArray(contentInfo.value) ||
      contentInfo.value.length < 2
    ) {
      logger.warn(`[MDM Proxy] ContentInfo invalid: ${describeAsn1(contentInfo, 0)}`);
      return null;
    }

    // Check contentType OID = signedData (1.2.840.113549.1.7.2)
    const oidNode = contentInfo.value[0];
    if (oidNode.type !== forge.asn1.OID) {
      logger.warn(`[MDM Proxy] ContentType is not OID: ${describeAsn1(oidNode, 0)}`);
      return null;
    }

    // content [0] EXPLICIT → SignedData SEQUENCE
    const explicitContent = contentInfo.value[1];
    if (
      !explicitContent.constructed ||
      !Array.isArray(explicitContent.value) ||
      !explicitContent.value[0]
    ) {
      logger.warn(`[MDM Proxy] Content field invalid: ${describeAsn1(explicitContent, 0)}`);
      return null;
    }
    const signedData = explicitContent.value[0];

    // SignedData: SEQUENCE { version, digestAlgorithms, encapContentInfo, ... }
    if (
      !signedData.constructed ||
      !Array.isArray(signedData.value) ||
      signedData.value.length < 3
    ) {
      logger.warn(`[MDM Proxy] SignedData invalid: ${describeAsn1(signedData, 0)}`);
      return null;
    }
    const encapContentInfo = signedData.value[2];

    // encapContentInfo: SEQUENCE { eContentType OID, eContent [0] EXPLICIT OCTET STRING }
    if (
      !encapContentInfo.constructed ||
      !Array.isArray(encapContentInfo.value) ||
      encapContentInfo.value.length < 2
    ) {
      logger.warn(`[MDM Proxy] encapContentInfo invalid: ${describeAsn1(encapContentInfo, 0)}`);
      return null;
    }
    const eContentExplicit = encapContentInfo.value[1];
    if (
      !eContentExplicit.constructed ||
      !Array.isArray(eContentExplicit.value) ||
      !eContentExplicit.value[0]
    ) {
      logger.warn(`[MDM Proxy] eContent [0] tag invalid: ${describeAsn1(eContentExplicit, 0)}`);
      return null;
    }
    const eContentOctet = eContentExplicit.value[0];
    const eContent = typeof eContentOctet.value === 'string' ? eContentOctet.value : null;
    if (!eContent || !eContent.trim()) {
      logger.warn(`[MDM Proxy] eContent value empty/invalid: ${describeAsn1(eContentOctet, 0)}`);
      return null;
    }

    // Extract certificates from SignedData (optional [0] IMPLICIT SET)
    const certs = [];
    for (let i = 3; i < signedData.value.length; i++) {
      const v = signedData.value[i];
      if (v.tagClass === 2 && v.type === 0 && v.constructed && Array.isArray(v.value)) {
        for (const certAsn1 of v.value) {
          try {
            const certDer = forge.asn1.toDer(certAsn1).getBytes();
            const cert = forge.pki.certificateFromAsn1(
              forge.asn1.fromDer(forge.util.createBuffer(certDer, 'binary')),
            );
            certs.push(cert);
          } catch (_) {}
        }
        break;
      }
    }

    logger.info(`[MDM Proxy] unwrapPkcs7 OK — ${eContent.length}B eContent, ${certs.length} certs`);
    return { eContent, certificates: certs };
  } catch (e) {
    logger.warn(`[MDM Proxy] unwrapPkcs7 exception: ${e.message}`);
    return null;
  }
}

function buildAuthenticatePlist(udid, serial) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>MessageType</key>
\t<string>Authenticate</string>
\t<key>Topic</key>
\t<string>${MDM_TOPIC}</string>
\t<key>UDID</key>
\t<string>${udid}</string>
\t<key>SerialNumber</key>
\t<string>${serial}</string>
</dict>
</plist>`;
}

function rawSignPlist(plistXml) {
  if (!mdmSigningKey || !mdmSigningCert) return null;
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(plistXml);
  p7.addCertificate(mdmSigningCert);
  p7.addSigner({
    key: mdmSigningKey,
    certificate: mdmSigningCert,
    digestAlgorithm: forge.pki.oids.sha256,
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

function isPkcs7Body(rawBody) {
  if (rawBody.length < 10) return false;
  const b = rawBody[0];
  return b === 0x30;
}

router.all('*', async (req, res) => {
  const startTime = Date.now();
  const rawBody = req.rawBody || Buffer.from('');
  const ct = (req.headers['content-type'] || '').toLowerCase();
  const isPkcs7 =
    ct.includes('pkcs7') ||
    ct.includes('application/pkcs7-signature') ||
    ct.includes('application/pkcs7-mime') ||
    (ct.includes('application/octet-stream') && isPkcs7Body(rawBody));

  if (isPkcs7) {
    const unwrapped = unwrapPkcs7(rawBody);
    if (!unwrapped) {
      logger.error(
        `[MDM Proxy] Failed to unwrap PKCS#7 — ct="${req.headers['content-type']}" body=${rawBody.length}B firstBytes=${rawBody.slice(0, 20).toString('hex')}`,
      );
      return res.status(400).end();
    }
    const { eContent, certificates } = unwrapped;

    const msgType = extractPlistValue(eContent, 'MessageType');
    const hasStatus = /<key>\s*Status\s*<\/key>/i.test(eContent);
    const udid = extractPlistValue(eContent, 'UDID');
    const serial =
      extractPlistValue(eContent, 'SERIAL') || extractPlistValue(eContent, 'SERIAL_NUMBER');

    // Non-standard identity payload – device capability data, not an MDM message
    if (!msgType && !hasStatus && udid) {
      logger.info(
        `[MDM Proxy] Identity payload — UDID=${udid} Serial=${serial} certs=${certificates.length}`,
      );

      const authXml = buildAuthenticatePlist(udid, serial);
      const sig = rawSignPlist(authXml);
      if (!sig) {
        logger.error('[MDM Proxy] Cannot sign Authenticate — no identity loaded');
        return res.status(500).end();
      }

      const resp = await axios({
        method: 'POST',
        url: `${NANO_URL()}/checkin`,
        data: Buffer.from(authXml, 'utf8'),
        headers: {
          'Content-Type': 'application/x-apple-aspen-mdm; charset=utf-8',
          'Mdm-Signature': sig.toString('base64'),
          Accept: '*/*',
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 15000,
      });

      logger.info(
        `[MDM Proxy] Authenticate → ${NANO_URL()}/checkin → ${resp.status} (${Date.now() - startTime}ms)`,
      );

      const exclude = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
      Object.entries(resp.headers).forEach(([k, v]) => {
        if (!exclude.includes(k.toLowerCase())) res.setHeader(k, v);
      });
      return res.status(resp.status).send(Buffer.from(resp.data));
    }

    // PKCS#7 check-in (e.g. Authenticate wrapped in PKCS#7)
    if (msgType) {
      const sig = rawSignPlist(eContent);
      if (!sig) {
        logger.error('[MDM Proxy] Cannot sign — no identity loaded');
        return res.status(500).end();
      }
      const resp = await axios({
        method: 'POST',
        url: `${NANO_URL()}/checkin`,
        data: Buffer.from(eContent, 'utf8'),
        headers: {
          'Content-Type': 'application/x-apple-aspen-mdm; charset=utf-8',
          'Mdm-Signature': sig.toString('base64'),
          Accept: '*/*',
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 15000,
      });
      logger.info(
        `[MDM Proxy] ${msgType} (PKCS#7) → ${NANO_URL()}/checkin → ${resp.status} (${Date.now() - startTime}ms)`,
      );
      const exclude = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
      Object.entries(resp.headers).forEach(([k, v]) => {
        if (!exclude.includes(k.toLowerCase())) res.setHeader(k, v);
      });
      return res.status(resp.status).send(Buffer.from(resp.data));
    }

    // PKCS#7 command result
    if (hasStatus) {
      const sig = rawSignPlist(eContent);
      if (!sig) {
        logger.error('[MDM Proxy] Cannot sign — no identity loaded');
        return res.status(500).end();
      }
      const resp = await axios({
        method: 'POST',
        url: `${NANO_URL()}/mdm`,
        data: Buffer.from(eContent, 'utf8'),
        headers: {
          'Content-Type': 'application/x-apple-aspen-mdm; charset=utf-8',
          'Mdm-Signature': sig.toString('base64'),
          Accept: '*/*',
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 15000,
      });
      logger.info(
        `[MDM Proxy] CommandResult (PKCS#7) → ${NANO_URL()}/mdm → ${resp.status} (${Date.now() - startTime}ms)`,
      );
      const exclude = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
      Object.entries(resp.headers).forEach(([k, v]) => {
        if (!exclude.includes(k.toLowerCase())) res.setHeader(k, v);
      });
      return res.status(resp.status).send(Buffer.from(resp.data));
    }

    // Unrecognised PKCS#7 – ack
    logger.info(`[MDM Proxy] Unrecognised PKCS#7 payload (${eContent.length}B) — returning 200`);
    return res.status(200).end();
  }

  // —— Plain XML (legacy / direct non-PKCS#7) ——
  const bodyStr = rawBody.toString('utf8');
  const msgType = extractPlistValue(bodyStr, 'MessageType');
  const hasStatus = /<key>\s*Status\s*<\/key>/i.test(bodyStr);

  if (msgType || hasStatus) {
    const sig = rawSignPlist(bodyStr);
    if (!sig) {
      logger.error('[MDM Proxy] Cannot sign — no identity loaded');
      return res.status(500).end();
    }
    const endpoint = msgType ? '/checkin' : '/mdm';
    const nanoUrl = `${NANO_URL()}${endpoint}`;
    const resp = await axios({
      method: 'POST',
      url: nanoUrl,
      data: rawBody,
      headers: {
        'Content-Type': 'application/x-apple-aspen-mdm; charset=utf-8',
        'Mdm-Signature': sig.toString('base64'),
        Accept: '*/*',
      },
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000,
    });
    logger.info(
      `[MDM Proxy] ${msgType || 'CommandResult'} (plain) → ${nanoUrl} → ${resp.status} (${Date.now() - startTime}ms)`,
    );
    const exclude = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
    Object.entries(resp.headers).forEach(([k, v]) => {
      if (!exclude.includes(k.toLowerCase())) res.setHeader(k, v);
    });
    return res.status(resp.status).send(Buffer.from(resp.data));
  }

  logger.info(`[MDM Proxy] Unknown payload (${rawBody.length}B) — returning 200`);
  res.status(200).end();
});

module.exports = router;
