const express = require('express');

const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
  res.json({
    message: 'Site Safe Admin Panel - MDM Backend API',
    version: '1.0.0',
    docs: '/api/docs',
  });
});

module.exports = router;
