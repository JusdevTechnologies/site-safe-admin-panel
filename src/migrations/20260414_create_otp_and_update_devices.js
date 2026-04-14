'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Create OneTimePassword table for device uninstallation OTP verification
     * Note: Base tables (devices, audit_logs, punch_records) are created in earlier migrations
     */
    await queryInterface.createTable('one_time_passwords', {
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
      otp_code: {
        type: Sequelize.STRING(8),
        allowNull: false,
        comment: '8-digit OTP code',
      },
      purpose: {
        type: Sequelize.ENUM('device_uninstall'),
        allowNull: false,
        defaultValue: 'device_uninstall',
        comment: 'Purpose of OTP generation',
      },
      is_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Flag to track if OTP has been used',
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when OTP was used',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Timestamp when OTP expires (5 minutes from creation)',
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of verification attempts',
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
        comment: 'Maximum allowed verification attempts',
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
     * Add indexes for OTP table
     */
    await queryInterface.addIndex('one_time_passwords', ['device_id']);
    await queryInterface.addIndex('one_time_passwords', ['otp_code']);
    await queryInterface.addIndex('one_time_passwords', ['expires_at']);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove indexes from OTP table
     */
    await queryInterface.removeIndex('one_time_passwords', ['device_id']);
    await queryInterface.removeIndex('one_time_passwords', ['otp_code']);
    await queryInterface.removeIndex('one_time_passwords', ['expires_at']);

    /**
     * Drop OTP table
     */
    await queryInterface.dropTable('one_time_passwords');
  },
};
