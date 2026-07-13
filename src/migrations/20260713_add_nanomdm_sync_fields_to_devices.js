'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('devices', 'serial_number', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Device serial number from NanoMDM',
    });

    await queryInterface.addColumn('devices', 'supervised', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Whether the device is under MDM supervision',
    });

    await queryInterface.addIndex('devices', ['serial_number'], {
      name: 'devices_serial_number_index',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeIndex('devices', 'devices_serial_number_index');
    await queryInterface.removeColumn('devices', 'supervised');
    await queryInterface.removeColumn('devices', 'serial_number');
  },
};
