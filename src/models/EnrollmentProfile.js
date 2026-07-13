module.exports = (sequelize, DataTypes) => {
  const EnrollmentProfile = sequelize.define(
    'EnrollmentProfile',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      profile_uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
      },
      display_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      organization: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      organization_display_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      department: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      checkin_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      is_mandatory: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      supervised: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      allow_profile_removal: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      await_device_configured: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      language: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      region: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      support_contact: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      support_email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      support_phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      identity_certificate_uuid: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      anchor_certificates: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      skip_setup_assistant_items: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      configuration: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'EnrollmentProfile',
      tableName: 'enrollment_profiles',
      timestamps: true,
      underscored: true,
    },
  );

  EnrollmentProfile.associate = (models) => {
    EnrollmentProfile.hasMany(models.AdeEnrollment, {
      foreignKey: 'profile_uuid',
      sourceKey: 'profile_uuid',
    });
  };

  return EnrollmentProfile;
};
