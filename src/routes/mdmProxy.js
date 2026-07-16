const express = require('express');
const axios = require('axios');
const forge = require('node-forge');
const logger = require('../utils/logger');
const environment = require('../../config/environment');

const router = express.Router();

function unwrapPKCS7(rawBody) {
  try {
    const buf = forge.util.createBuffer(rawBody.toString('binary'));
    const asn1 = forge.asn1.fromDer(buf);

    // ContentInfo: SEQUENCE { contentType OID, content [0] EXPLICIT { SignedData } }
    const contentInfo = asn1;
    const signedDataTagged = contentInfo.value[1];
    const signedData = signedDataTagged.value[0];

    // SignedData: SEQUENCE { version, digestAlgorithms, encapContentInfo, ... }
    const encapContentInfo = signedData.value[2];

    // EncapsulatedContentInfo: SEQUENCE { eContentType OID, eContent [0] EXPLICIT { OCTET STRING } }
    let innerBytes = Buffer.from('');
    if (encapContentInfo.value.length > 1) {
      const eContentTagged = encapContentInfo.value[1];
      // eContent is wrapped in [0] EXPLICIT → OCTET STRING
      // May be constructed (tag 0x24) with nested primitive (tag 0x04)
      const rawContent = extractOctetBytes(eContentTagged);
      innerBytes = Buffer.from(rawContent, 'binary');
    }

    // Extract certificates from SignedData for logging
    const certsTagged = signedData.value[3];
    const certs = certsTagged && certsTagged.value ? certsTagged.value : [];
    const cn = certs.length > 0 ? extractCN(certs[0]) || 'unknown' : 'no-cert';

    logger.info(`[MDM Proxy]   PKCS#7 parsed: certs=${certs.length}, CN=${cn}`);
    logger.info(
      `[MDM Proxy]   PKCS#7 wrapper: ${rawBody.length} bytes, inner content: ${innerBytes.length} bytes`,
    );
    if (innerBytes.length > 0) {
      logger.info(
        `[MDM Proxy]   Inner content (utf8): ${innerBytes.toString('utf8').substring(0, 400)}`,
      );
    } else {
      logger.warn('[MDM Proxy]   Inner content EMPTY — plist extraction failed');
    }

    return {
      mdmSignature: rawBody.toString('base64'),
      bodyBytes: innerBytes,
      bodyContentType: 'application/x-apple-aspen-mdm',
    };
  } catch (e) {
    logger.warn(`[MDM Proxy]   PKCS#7 unwrap failed: ${e.message}`);
  }
  return null;
}

function extractOctetBytes(asn1Node) {
  if (!asn1Node) return '';

  // Context-specific [0] EXPLICIT (tag byte 0xa0): recurse into first child
  const isContextTag0 =
    asn1Node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && asn1Node.type === 0;
  if (isContextTag0 && Array.isArray(asn1Node.value) && asn1Node.value.length > 0) {
    return extractOctetBytes(asn1Node.value[0]);
  }

  // OCTET STRING (universal tag 4): primitive → string, constructed → recurse
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

function extractCN(asn1Cert) {
  try {
    const cert = forge.pki.certificateFromAsn1(asn1Cert);
    const cn = cert.subject.getField('CN');
    return cn ? cn.value : null;
  } catch (_) {
    return null;
  }
}

router.all('*', async (req, res) => {
  const startTime = Date.now();
  const targetUrl = `${environment.nanomdm.baseUrl.replace(/\/+$/, '')}${req.originalUrl}`;

  const logHeaders = { ...req.headers };
  const redactedHeaders = ['authorization', 'cookie', 'set-cookie'];
  redactedHeaders.forEach((h) => delete logHeaders[h]);

  logger.info('========================================================');
  logger.info('[MDM Proxy] === INCOMING REQUEST ===');
  logger.info(`[MDM Proxy]   Method: ${req.method}`);
  logger.info(`[MDM Proxy]   Path:   ${req.originalUrl}`);
  logger.info(`[MDM Proxy]   Target: ${targetUrl}`);
  logger.info(`[MDM Proxy]   IP:     ${req.ip}`);

  let contentType = req.headers['content-type'] || '';
  let mdmSignature = req.headers['mdm-signature'];
  let rawBody = req.rawBody || Buffer.from('');

  if (mdmSignature) {
    logger.info(`[MDM Proxy]   Mdm-Signature: PRESENT (${mdmSignature.length} chars)`);
  } else if (contentType === 'application/pkcs7-signature' && rawBody.length > 0) {
    logger.info('[MDM Proxy]   Mdm-Signature: ABSENT, unwrapping PKCS#7 body...');
    logger.info(`[MDM Proxy]   Content-Type: ${contentType} — body is PKCS#7 signed`);

    const unwrapped = unwrapPKCS7(rawBody);
    if (unwrapped) {
      mdmSignature = unwrapped.mdmSignature;
      rawBody = unwrapped.bodyBytes;
      contentType = unwrapped.bodyContentType;
      logger.info(
        `[MDM Proxy]   Unwrapped: header=${mdmSignature.length} chars, body=${rawBody.length} bytes, ct=${contentType}`,
      );
    } else {
      logger.warn('[MDM Proxy]   PKCS#7 unwrap FAILED — forwarding as-is');
    }
  } else {
    logger.warn('[MDM Proxy]   Mdm-Signature: ABSENT (no PKCS#7 body to extract from)');
  }

  Object.entries(logHeaders).forEach(([key, value]) => {
    logger.info(`[MDM Proxy]   Header ${key}: ${value}`);
  });

  logger.info(`[MDM Proxy]   Body length: ${rawBody.length} bytes`);
  if (rawBody.length > 0) {
    logger.info(
      `[MDM Proxy]   Body (hex, first 500): ${rawBody.toString('hex').substring(0, 500)}`,
    );
    logger.info(`[MDM Proxy]   Body (utf8): ${rawBody.toString('utf8').substring(0, 500)}`);
  } else {
    logger.warn('[MDM Proxy]   Body: EMPTY');
  }

  try {
    const forwardHeaders = {
      'Content-Type': contentType || 'application/x-apple-aspen-mdm',
      Accept: req.headers['accept'] || '*/*',
      'User-Agent': req.headers['user-agent'] || '',
      'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
    };
    if (mdmSignature) {
      forwardHeaders['Mdm-Signature'] = mdmSignature;
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: rawBody.length > 0 ? rawBody : undefined,
      headers: forwardHeaders,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    const elapsed = Date.now() - startTime;
    logger.info(`[MDM Proxy] === RESPONSE (${elapsed}ms) ===`);
    logger.info(`[MDM Proxy]   Status: ${response.status}`);
    Object.entries(response.headers).forEach(([key, value]) => {
      logger.info(`[MDM Proxy]   Response header ${key}: ${value}`);
    });
    logger.info(`[MDM Proxy]   Response body: ${response.data ? response.data.length : 0} bytes`);
    if (response.data && response.data.length > 0) {
      const bodyStr = Buffer.from(response.data).toString('utf8');
      logger.info(`[MDM Proxy]   Response (utf8): ${bodyStr.substring(0, 1000)}`);
    }
    logger.info('[MDM Proxy] === END ===');
    logger.info('========================================================');

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
    logger.error(`[MDM Proxy] === ERROR (${elapsed}ms) ===`);
    logger.error(`[MDM Proxy]   Error: ${error.message}`);
    if (error.response) {
      logger.error(`[MDM Proxy]   Response status: ${error.response.status}`);
      logger.error(`[MDM Proxy]   Response data: ${error.response.data}`);
    }
    logger.error('[MDM Proxy] === END ===');
    logger.error('========================================================');
    res.status(502).json({ error: 'MDM proxy error', message: error.message });
  }
});

module.exports = router;
