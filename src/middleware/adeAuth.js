const environment = require('../../config/environment');
const { HTTP_STATUS } = require('../constants');

const adeAuth = (req, res, next) => {
  const apiKey = req.headers['x-ade-api-key'];

  if (!apiKey) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        message: 'ADE API key is required',
        code: 'UNAUTHORIZED',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      },
    });
  }

  if (apiKey !== environment.ade.apiKey) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      error: {
        message: 'Invalid ADE API key',
        code: 'FORBIDDEN',
        statusCode: HTTP_STATUS.FORBIDDEN,
      },
    });
  }

  next();
};

module.exports = adeAuth;
