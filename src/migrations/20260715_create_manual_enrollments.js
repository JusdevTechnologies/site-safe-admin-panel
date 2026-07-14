module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('manual_enrollments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      serial_number: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      udid: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('waiting', 'enrolled', 'failed'),
        defaultValue: 'waiting',
      },
      profile_uuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      enrolled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('manual_enrollments', ['serial_number'], {
      name: 'manual_enrollments_serial_number_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('manual_enrollments');
  },
};
