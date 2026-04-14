'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Create OneTimePassword table for device uninstallation OTP verification
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

    /**
     * Add push notification token fields to devices table
     */
    await queryInterface.addColumn('devices', 'push_notification_token', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Azure Notification Hub push notification token',
    });

    await queryInterface.addColumn('devices', 'notification_platform', {
      type: Sequelize.ENUM('fcm', 'apns'),
      allowNull: true,
      comment: 'Push notification platform (FCM for Android, APNS for iOS)',
    });

    await queryInterface.addColumn('devices', 'last_push_notification_update', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp of last push notification token update',
    });

    /**
     * Add index on device_identifier for faster lookups
     */
    await queryInterface.addIndex('devices', ['device_identifier']);

    /**
     * Add audit tracking columns to devices table
     */
    await queryInterface.addColumn('devices', 'camera_blocked_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'User ID of admin who blocked the camera',
    });

    await queryInterface.addColumn('devices', 'camera_blocked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when camera was blocked',
    });

    /**
     * Add indexes on audit_logs table for faster queries
     */
    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);

    /**
     * Add index on punch_records table for recent activity queries
     */
    await queryInterface.addIndex('punch_records', ['employee_id', 'timestamp']);
    await queryInterface.addIndex('punch_records', ['punch_type', 'timestamp']);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove indexes from punch_records table
     */
    await queryInterface.removeIndex('punch_records', ['employee_id', 'timestamp']);
    await queryInterface.removeIndex('punch_records', ['punch_type', 'timestamp']);

    /**
     * Remove indexes from audit_logs table
     */
    await queryInterface.removeIndex('audit_logs', ['user_id']);
    await queryInterface.removeIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.removeIndex('audit_logs', ['created_at']);

    /**
     * Remove audit tracking columns from devices table
     */
    await queryInterface.removeColumn('devices', 'camera_blocked_by');
    await queryInterface.removeColumn('devices', 'camera_blocked_at');

    /**
     * Remove indexes from devices table
     */
    await queryInterface.removeIndex('devices', ['device_identifier']);

    /**
     * Remove columns from devices table
     */
    await queryInterface.removeColumn('devices', 'push_notification_token');
    await queryInterface.removeColumn('devices', 'notification_platform');
    await queryInterface.removeColumn('devices', 'last_push_notification_update');

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
