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

function loadSigningIdentity() {
  const certPath = environment.ade.identityCertPath;
  const password = environment.ade.identityCertPassword;
  if (!certPath || !password) {
    logger.info('[MDM Proxy] No signing identity configured');
    return;
  }
  try {
    const p12Buffer = fs.readFileSync(path.resolve(certPath));
    const buf = forge.util.createBuffer(p12Buffer.toString('binary'));
    const asn1 = forge.asn1.fromDer(buf);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBagsPlain = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const keyBag =
      (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] &&
        keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0]) ||
      (keyBagsPlain[forge.pki.oids.keyBag] && keyBagsPlain[forge.pki.oids.keyBag][0]);
    if (!keyBag) throw new Error('No private key in PKCS#12');

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certList = certBags[forge.pki.oids.certBag] || [];
    if (certList.length === 0) throw new Error('No certificate in PKCS#12');

    mdmSigningKey = keyBag.key;
    mdmSigningCert = certList[0].cert;

    const cn = mdmSigningCert.subject.getField('CN')?.value || 'unknown';
    logger.info(`[MDM Proxy] Signing identity loaded: CN=${cn}`);
  } catch (e) {
    logger.error(`[MDM Proxy] Failed to load signing identity: ${e.message}`);
  }
}

loadSigningIdentity();

function unwrapPKCS7(rawBody) {
  try {
    const buf = forge.util.createBuffer(rawBody.toString('binary'));
    const asn1 = forge.asn1.fromDer(buf);
    const contentInfo = asn1;
    const signedDataTagged = contentInfo.value[1];
    const signedData = signedDataTagged.value[0];
    const encapContentInfo = signedData.value[2];

    let innerBytes = Buffer.from('');
    if (encapContentInfo.value.length > 1) {
      const eContentTagged = encapContentInfo.value[1];
      const rawContent = extractOctetBytes(eContentTagged);
      innerBytes = Buffer.from(rawContent, 'binary');
    }

    return {
      mdmSignature: rawBody.toString('base64'),
      bodyBytes: innerBytes,
      bodyContentType: 'application/x-apple-aspen-mdm',
    };
  } catch (e) {
    logger.warn(`[MDM Proxy] PKCS#7 unwrap failed: ${e.message}`);
  }
  return null;
}

function extractOctetBytes(asn1Node) {
  if (!asn1Node) return '';
  const isContextTag0 =
    asn1Node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && asn1Node.type === 0;
  if (isContextTag0 && Array.isArray(asn1Node.value) && asn1Node.value.length > 0) {
    return extractOctetBytes(asn1Node.value[0]);
  }
  const isOctet =
    asn1Node.tagClass === forge.asn1.Class.UNIVERSAL &&
    asn1Node.type === forge.asn1.Type.OCTETSTRING;
  if (isOctet) {
    if (typeof asn1Node.value === 'string') {
      return asn1Node.value;
    }
    if (Array.isArray(asn1Node.value)) {
      return asn1Node.value.map((n) => extractOctetBytes(n)).join('');
    }
  }
  return '';
}

function reSignContent(bodyBytes) {
  if (!mdmSigningKey || !mdmSigningCert) return null;
  try {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(bodyBytes.toString('binary'));
    p7.addCertificate(mdmSigningCert);
    p7.addSigner({
      key: mdmSigningKey,
      certificate: mdmSigningCert,
      digestAlgorithm: forge.pki.oids.sha256,
    });
    p7.sign({ detached: true });
    const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return Buffer.from(derBytes, 'binary');
  } catch (e) {
    logger.warn(`[MDM Proxy] Re-sign failed: ${e.message}`);
    return null;
  }
}

router.all('*', async (req, res) => {
  const startTime = Date.now();
  let targetUrl = `${environment.nanomdm.baseUrl.replace(/\/+$/, '')}${req.originalUrl}`;

  let contentType = req.headers['content-type'] || '';
  let mdmSignature = req.headers['mdm-signature'];
  let rawBody = req.rawBody || Buffer.from('');

  if (!mdmSignature && contentType === 'application/pkcs7-signature' && rawBody.length > 0) {
    const unwrapped = unwrapPKCS7(rawBody);
    if (unwrapped) {
      const newSig = reSignContent(unwrapped.bodyBytes);
      if (newSig) {
        mdmSignature = newSig.toString('base64');
      } else {
        mdmSignature = unwrapped.mdmSignature;
      }
      rawBody = unwrapped.bodyBytes;
      contentType = unwrapped.bodyContentType;
    }
  }

  // Check what kind of message this is
  const bodyStr = rawBody.toString('utf8');
  const mtMatch = bodyStr.match(/<key>\s*MessageType\s*<\/key>\s*<string>\s*([^<]+)\s*<\/string>/i);
  const mdmMessageType = mtMatch ? mtMatch[1] : null;
  const hasStatus = /<key>\s*Status\s*<\/key>/i.test(bodyStr);

  // Non-standard request (no MessageType or Status) — device capability data
  if (!mdmMessageType && !hasStatus && rawBody.length > 0) {
    logger.info(`[MDM Proxy] Non-standard payload (${rawBody.length}B) — acking device, continuing`);
    return res.status(200).end();
  }

  if (mdmMessageType) {
    targetUrl = targetUrl.replace(/\/mdm$/i, '/checkin');
  }

  const forwardHeaders = {
    'Content-Type': contentType || 'application/x-apple-aspen-mdm',
    Accept: req.headers['accept'] || '*/*',
    'User-Agent': req.headers['user-agent'] || '',
    'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
  };
  if (mdmSignature) {
    forwardHeaders['Mdm-Signature'] = mdmSignature;
  }

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: rawBody.length > 0 ? rawBody : undefined,
      headers: forwardHeaders,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    const elapsed = Date.now() - startTime;
    logger.info(`[MDM Proxy] ${req.method} ${req.originalUrl} → ${targetUrl} → ${response.status} (${elapsed}ms)`);

    const excludeHeaders = ['transfer-encoding', 'connection', 'keep-alive', 'upgrade'];
    Object.entries(response.headers).forEach(([key, value]) => {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.status(response.status);
    res.send(Buffer.from(response.data));
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[MDM Proxy] ${req.method} ${req.originalUrl} → ERROR: ${error.message} (${elapsed}ms)`);
    res.status(502).json({ error: 'MDM proxy error', message: error.message });
  }
});

module.exports = router;
