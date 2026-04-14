'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Create device_policies table
     */
    await queryInterface.createTable('device_policies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      device_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'devices',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      policy_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      policy_details: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      applied_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('device_policies', ['device_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('device_policies');
  },
};
