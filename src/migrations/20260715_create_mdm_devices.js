module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('mdm_devices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      udid: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      serial_number: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      model: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      os_version: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      enrollment_status: {
        type: Sequelize.ENUM('enrolled', 'not_found', 'pending'),
        defaultValue: 'pending',
      },
      push_token_status: {
        type: Sequelize.ENUM('valid', 'invalid', 'unknown'),
        defaultValue: 'unknown',
      },
      camera_state: {
        type: Sequelize.ENUM('restricted', 'unrestricted', 'unknown'),
        defaultValue: 'unknown',
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_sync_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      device_info: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('mdm_devices', ['udid'], { unique: true, name: 'mdm_devices_udid_idx' });
    await queryInterface.addIndex('mdm_devices', ['serial_number'], { name: 'mdm_devices_serial_number_idx' });
    await queryInterface.addIndex('mdm_devices', ['enrollment_status'], { name: 'mdm_devices_enrollment_status_idx' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('mdm_devices');
  },
};
