'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ade_enrollments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      device_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'devices',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Local device ID (link when device record exists)',
      },
      serial_number: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Device serial number from Apple DEP',
      },
      udid: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Device UDID from Apple DEP or NanoMDM',
      },
      model: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Device model identifier (e.g. iPhone15,2)',
      },
      profile_uuid: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'enrollment_profiles',
          key: 'profile_uuid',
        },
        onDelete: 'SET NULL',
        comment: 'UUID of the assigned enrollment profile',
      },
      organization: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Organization name displayed during enrollment',
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'assigned',
          'enrollment_started',
          'checkin_received',
          'mdm_connection',
          'completed',
          'failed',
        ),
        defaultValue: 'pending',
        comment: 'Current enrollment lifecycle status',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Arbitrary metadata for extensibility',
      },
      enrolled_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the device started enrollment',
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When enrollment was completed',
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

    await queryInterface.addIndex('ade_enrollments', ['serial_number'], {
      name: 'ade_enrollments_serial_number_index',
    });
    await queryInterface.addIndex('ade_enrollments', ['device_id'], {
      name: 'ade_enrollments_device_id_index',
    });
    await queryInterface.addIndex('ade_enrollments', ['status'], {
      name: 'ade_enrollments_status_index',
    });
    await queryInterface.addIndex('ade_enrollments', ['profile_uuid'], {
      name: 'ade_enrollments_profile_uuid_index',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('ade_enrollments');
  },
};
