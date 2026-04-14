'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Create punch_records table
     */
    await queryInterface.createTable('punch_records', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      employee_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      punch_type: {
        type: Sequelize.ENUM('punch_in', 'punch_out'),
        allowNull: false,
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      source_system: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'access_management',
      },
      external_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    /**
     * Add indexes
     */
    await queryInterface.addIndex('punch_records', ['employee_id', 'timestamp']);
    await queryInterface.addIndex('punch_records', ['punch_type', 'timestamp']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('punch_records');
  },
};
