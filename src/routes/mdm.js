const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const MdmDeviceController = require('../controllers/MdmDeviceController');

const router = express.Router();

router.get(
  '/devices',
  authenticate,
  authorize('super_admin'),
  MdmDeviceController.listDevices.bind(MdmDeviceController),
);

router.get(
  '/devices/:id',
  authenticate,
  authorize('super_admin'),
  MdmDeviceController.getDevice.bind(MdmDeviceController),
);

router.post(
  '/devices/:id/camera/disable',
  authenticate,
  authorize('super_admin'),
  MdmDeviceController.disableCamera.bind(MdmDeviceController),
);

router.post(
  '/devices/:id/camera/enable',
  authenticate,
  authorize('super_admin'),
  MdmDeviceController.enableCamera.bind(MdmDeviceController),
);

router.post(
  '/devices/:id/removable',
  authenticate,
  authorize('super_admin'),
  MdmDeviceController.updateMdmRemovable.bind(MdmDeviceController),
);

router.get(
  '/devices/:id/commands',
  authenticate,
  authorize('super_admin'),
  MdmDeviceController.getDeviceCommands.bind(MdmDeviceController),
);

router.post(
  '/sync',
  authenticate,
  authorize('super_admin'),
  MdmDeviceController.syncDevices.bind(MdmDeviceController),
);

module.exports = router;
