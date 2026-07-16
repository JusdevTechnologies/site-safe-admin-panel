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
    const p7 = forge.pkcs7.messageFromAsn1(asn1);

    const cn =
      p7.certificates && p7.certificates.length > 0
        ? p7.certificates[0].subject.getField('CN')?.value || 'unknown'
        : 'no-cert';

    const innerContent = p7.content;
    const innerBytes = innerContent
      ? Buffer.from(innerContent.getBytes(), 'binary')
      : Buffer.from('');

    logger.info(
      `[MDM Proxy]   PKCS#7 parsed: type=${p7.type}, certs=${p7.certificates ? p7.certificates.length : 0}, CN=${cn}`,
    );
    logger.info(
      `[MDM Proxy]   PKCS#7 wrapper: ${rawBody.length} bytes, inner content: ${innerBytes.length} bytes`,
    );
    logger.info(
      `[MDM Proxy]   Inner content (utf8): ${innerBytes.toString('utf8').substring(0, 300)}`,
    );

    // Mdm-Signature header: the full PKCS#7 body (base64)
    const headerB64 = rawBody.toString('base64');

    // Forward body: the raw inner plist (not the PKCS#7 wrapper)
    const bodyBytes = innerBytes;

    // Forward Content-Type: raw MDM (not PKCS#7)
    const bodyContentType = 'application/x-apple-aspen-mdm';

    return {
      mdmSignature: headerB64,
      bodyBytes,
      bodyContentType,
    };
  } catch (e) {
    logger.warn(`[MDM Proxy]   PKCS#7 parsing failed: ${e.message}`);
  }
  return null;
}
  return null;
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
