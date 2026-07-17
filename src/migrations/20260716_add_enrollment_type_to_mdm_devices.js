'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('mdm_devices', 'enrollment_type', {
      type: Sequelize.ENUM('device', 'user'),
      allowNull: true,
      comment: 'Enrollment type: device (ADE/DEP) or user (OTA/profile download)',
    });

    await queryInterface.addIndex('mdm_devices', ['enrollment_type'], {
      name: 'mdm_devices_enrollment_type_idx',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeIndex('mdm_devices', 'mdm_devices_enrollment_type_idx');
    await queryInterface.removeColumn('mdm_devices', 'enrollment_type');
  },
};
