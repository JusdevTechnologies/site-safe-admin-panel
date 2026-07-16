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

function unwrapPkcs7(rawBody) {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(rawBody.toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1);
    if (p7.type !== forge.pki.oids.signedData) return null;
    const rc = p7.rawCapture;
    if (!rc || !rc.content || !Array.isArray(rc.content.value) || !rc.content.value[0]) return null;
    const eContent = rc.content.value[0].value;
    if (typeof eContent !== 'string' || !eContent.trim()) return null;

    const certs = [];
    if (rc.certificates && Array.isArray(rc.certificates.value)) {
      for (const certAsn1 of rc.certificates.value) {
        try {
          const der = forge.asn1.toDer(certAsn1).getBytes();
          const cert = forge.pki.certificateFromAsn1(
            forge.asn1.fromDer(forge.util.createBuffer(der, 'binary')),
          );
          certs.push(cert);
        } catch (_) {}
      }
    }

    return {
      eContent,
      certificates: certs,
      signerInfos: Array.isArray(rc.signerInfos) ? rc.signerInfos : [],
    };
  } catch (e) {
    logger.warn(`[MDM Proxy] unwrapPkcs7 failed: ${e.message}`);
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
      logger.error('[MDM Proxy] Failed to unwrap PKCS#7 body');
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
