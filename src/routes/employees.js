const express = require('express');

const router = express.Router();

/**
 * Employee management is handled via the authenticated admin routes.
 * All CRUD operations are available at /api/v1/admin/employees/*
 *
 * GET    /api/v1/admin/employees        - Get all employees
 * POST   /api/v1/admin/employees        - Create employee
 * GET    /api/v1/admin/employees/:id    - Get employee by ID
 * PATCH  /api/v1/admin/employees/:id    - Update employee
 * DELETE /api/v1/admin/employees/:id    - Delete employee
 */

module.exports = router;
