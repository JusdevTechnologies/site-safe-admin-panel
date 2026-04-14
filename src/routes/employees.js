const express = require('express');

const router = express.Router();

/**
 * Employee Routes
 * GET    /api/v1/employees     - Get all employees
 * POST   /api/v1/employees     - Create employee
 * GET    /api/v1/employees/:id - Get employee by ID
 * PUT    /api/v1/employees/:id - Update employee
 * DELETE /api/v1/employees/:id - Delete employee
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

module.exports = router;
