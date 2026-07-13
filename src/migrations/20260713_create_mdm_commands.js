'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mdm_commands', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      command_uuid: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'UUID returned by NanoMDM for this command',
      },
      device_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'devices',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Local device ID (resolved from device_identifier)',
      },
      device_identifier: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Device UDID the command was sent to',
      },
      command_type: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'e.g. InstallProfile, RemoveProfile, DeviceInformation',
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'sent',
        comment: 'queued | sent | acknowledged | failed',
      },
      request_payload: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Full request body sent to NanoMDM',
      },
      response_data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Response data from NanoMDM',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error details if the command failed',
      },
      retry_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      max_retries: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
      },
      queued_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      acknowledged_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_at: {
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

    await queryInterface.addIndex('mdm_commands', ['command_uuid'], {
      name: 'mdm_commands_command_uuid_index',
    });
    await queryInterface.addIndex('mdm_commands', ['device_id'], {
      name: 'mdm_commands_device_id_index',
    });
    await queryInterface.addIndex('mdm_commands', ['status'], {
      name: 'mdm_commands_status_index',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('mdm_commands');
  },
};
