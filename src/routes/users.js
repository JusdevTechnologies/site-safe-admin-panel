const express = require('express');

const router = express.Router();

/**
 * User Routes (Super Admin)
 * GET    /api/v1/users         - Get all users
 * POST   /api/v1/users         - Create new user
 * GET    /api/v1/users/:id     - Get user by ID
 * PUT    /api/v1/users/:id     - Update user
 * DELETE /api/v1/users/:id     - Delete user
 * PUT    /api/v1/users/:id/status - Update user status
 */

router.get('/', (req, res) => {
  res.status(501).json({ message: 'Not Implemented' });
});

router.post('/', (req, res) => {
  res.status(501).json({ message: 'Not Implemented' });
});

router.get('/:id', (req, res) => {
  res.status(501).json({ message: 'Not Implemented' });
});

router.put('/:id', (req, res) => {
  res.status(501).json({ message: 'Not Implemented' });
});

router.delete('/:id', (req, res) => {
  res.status(501).json({ message: 'Not Implemented' });
});

router.put('/:id/status', (req, res) => {
  res.status(501).json({ message: 'Not Implemented' });
});

module.exports = router;
