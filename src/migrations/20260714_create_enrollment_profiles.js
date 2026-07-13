'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('enrollment_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      profile_uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        unique: true,
        comment: 'Public UUID used to reference this profile externally',
      },
      display_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Human-readable profile name',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional description of the profile',
      },
      organization: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Organization name displayed during enrollment',
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Server URL included in the enrollment profile',
      },
      version: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: 'Profile version number for tracking changes',
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this is the default profile for new devices',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this profile is active and can be assigned',
      },
      configuration: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional profile configuration payload',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Arbitrary metadata for extensibility',
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

    await queryInterface.addIndex('enrollment_profiles', ['profile_uuid'], {
      name: 'enrollment_profiles_profile_uuid_index',
    });
    await queryInterface.addIndex('enrollment_profiles', ['is_default'], {
      name: 'enrollment_profiles_is_default_index',
    });
    await queryInterface.addIndex('enrollment_profiles', ['is_active'], {
      name: 'enrollment_profiles_is_active_index',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('enrollment_profiles');
  },
};
