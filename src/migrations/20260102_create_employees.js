'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Create employees table
     */
    await queryInterface.createTable('employees', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      employee_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      department: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      device_os: {
        type: Sequelize.ENUM('android', 'ios'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    /**
     * Add indexes
     */
    await queryInterface.addIndex('employees', ['user_id']);
    await queryInterface.addIndex('employees', ['employee_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('employees');
  },
};
