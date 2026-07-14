const express = require('express');
const EnrollController = require('../controllers/EnrollController');

const router = express.Router();

router.get('/', EnrollController.getProfile.bind(EnrollController));

router.get('/status/:serial', EnrollController.getStatus.bind(EnrollController));

module.exports = router;
