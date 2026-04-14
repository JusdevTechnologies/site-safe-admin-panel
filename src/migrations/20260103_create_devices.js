'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Create devices table
     */
    await queryInterface.createTable('devices', {
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
      device_identifier: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      device_os: {
        type: Sequelize.ENUM('android', 'ios'),
        allowNull: false,
      },
      device_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'blocked', 'lost'),
        defaultValue: 'active',
      },
      camera_blocked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      last_sync: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      device_info: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      push_notification_token: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Azure Notification Hub push notification token',
      },
      notification_platform: {
        type: Sequelize.ENUM('fcm', 'apns'),
        allowNull: true,
        comment: 'Push notification platform (FCM for Android, APNS for iOS)',
      },
      last_push_notification_update: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of last push notification token update',
      },
      camera_blocked_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'User ID of admin who blocked the camera',
      },
      camera_blocked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when camera was blocked',
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
    await queryInterface.addIndex('devices', ['employee_id']);
    await queryInterface.addIndex('devices', ['device_identifier']);
    await queryInterface.addIndex('devices', ['camera_blocked_by']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('devices');
  },
};
