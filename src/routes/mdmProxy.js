const express = require('express');
const axios = require('axios');
const forge = require('node-forge');
const logger = require('../utils/logger');
const environment = require('../../config/environment');

const router = express.Router();

function extractCertFromPKCS7(rawBody) {
  try {
    const buf = forge.util.createBuffer(rawBody.toString('binary'));
    const asn1 = forge.asn1.fromDer(buf);
    const p7 = forge.pkcs7.messageFromAsn1(asn1);

    if (p7.certificates && p7.certificates.length > 0) {
      const cert = p7.certificates[0];
      const certAsn1 = forge.pki.certificateToAsn1(cert);
      const certDer = forge.asn1.toDer(certAsn1);
      const derBytes = Buffer.from(certDer.getBytes(), 'binary');
      const b64 = derBytes.toString('base64');

      const cn =
        cert.subject.getField('CN')?.value || 'unknown';

      logger.info(`[MDM Proxy]   PKCS#7 extracted cert: CN=${cn}, DER=${derBytes.length} bytes`);

      return b64;
    }

    logger.warn('[MDM Proxy]   PKCS#7 body has no certificates');
  } catch (e) {
    logger.warn(`[MDM Proxy]   PKCS#7 extraction failed: ${e.message}`);
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

  const contentType = req.headers['content-type'] || '';
  let mdmSignature = req.headers['mdm-signature'];
  const rawBody = req.rawBody || Buffer.from('');

  if (mdmSignature) {
    logger.info(
      `[MDM Proxy]   Mdm-Signature: PRESENT (${mdmSignature.length} chars)`,
    );
  } else if (contentType === 'application/pkcs7-signature' && rawBody.length > 0) {
    logger.info('[MDM Proxy]   Mdm-Signature: ABSENT, trying PKCS#7 extraction...');
    logger.info(`[MDM Proxy]   Content-Type: ${contentType} — body is PKCS#7 signed`);

    const certB64 = extractCertFromPKCS7(rawBody);
    if (certB64) {
      mdmSignature = certB64;
      logger.info(
        `[MDM Proxy]   PKCS#7 extraction SUCCESS. Injected Mdm-Signature (${mdmSignature.length} chars)`,
      );
    } else {
      logger.warn('[MDM Proxy]   PKCS#7 extraction FAILED — forwarding without Mdm-Signature');
    }
  } else {
    logger.warn('[MDM Proxy]   Mdm-Signature: ABSENT (no PKCS#7 body to extract from)');
  }

  Object.entries(logHeaders).forEach(([key, value]) => {
    logger.info(`[MDM Proxy]   Header ${key}: ${value}`);
  });

  logger.info(`[MDM Proxy]   Body length: ${rawBody.length} bytes`);
  if (rawBody.length > 0) {
    logger.info(`[MDM Proxy]   Body (hex, first 500): ${rawBody.toString('hex').substring(0, 500)}`);
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
