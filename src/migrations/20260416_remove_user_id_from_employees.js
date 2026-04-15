'use strict';

/**
 * Migration: Remove user_id FK from employees table.
 *
 * Employees are a standalone entity in the system – they are NOT linked to
 * the admin/user accounts table.  Personal details (first_name, last_name,
 * email) are stored directly on the employee record.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ------------------------------------------------------------------
    // 1. Remove the user_id index (if it exists) before dropping the column
    // ------------------------------------------------------------------
    try {
      await queryInterface.removeIndex('employees', ['user_id']);
    } catch (_) {
      // Index may not exist – safe to ignore
    }

    // ------------------------------------------------------------------
    // 2. Drop the user_id foreign key constraint then the column
    // ------------------------------------------------------------------
    await queryInterface.removeColumn('employees', 'user_id');

    // ------------------------------------------------------------------
    // 3. Add personal-details columns directly on employees
    // ------------------------------------------------------------------
    await queryInterface.addColumn('employees', 'first_name', {
      type: Sequelize.STRING(100),
      allowNull: false,
      defaultValue: '',
    });

    await queryInterface.addColumn('employees', 'last_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('employees', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('employees', 'phone', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });

    // ------------------------------------------------------------------
    // 4. Add index on employee email for fast lookup
    // ------------------------------------------------------------------
    await queryInterface.addIndex('employees', ['email'], {
      name: 'employees_email_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    // Reverse: remove new columns and restore user_id

    try {
      await queryInterface.removeIndex('employees', 'employees_email_idx');
    } catch (_) {}

    await queryInterface.removeColumn('employees', 'phone');
    await queryInterface.removeColumn('employees', 'email');
    await queryInterface.removeColumn('employees', 'last_name');
    await queryInterface.removeColumn('employees', 'first_name');

    await queryInterface.addColumn('employees', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true, // nullable in rollback to avoid constraint issues on existing rows
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    });

    await queryInterface.addIndex('employees', ['user_id']);
  },
};
