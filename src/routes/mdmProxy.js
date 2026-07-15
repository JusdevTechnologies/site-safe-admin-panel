const express = require('express');
const axios = require('axios');
const logger = require('../utils/logger');
const environment = require('../../config/environment');

const router = express.Router();

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

  const mdmSignature = req.headers['mdm-signature'];
  if (mdmSignature) {
    logger.info(
      `[MDM Proxy]   Mdm-Signature: PRESENT (${mdmSignature.length} chars, first 50: "${mdmSignature.substring(0, 50)}...")`,
    );
  } else {
    logger.warn('[MDM Proxy]   Mdm-Signature: ABSENT');
  }

  Object.entries(logHeaders).forEach(([key, value]) => {
    logger.info(`[MDM Proxy]   Header ${key}: ${value}`);
  });

  const rawBody = req.rawBody || Buffer.from('');
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
      'Content-Type': req.headers['content-type'] || 'application/x-apple-aspen-mdm',
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
