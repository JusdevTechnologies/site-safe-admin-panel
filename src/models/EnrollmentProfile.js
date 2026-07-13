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
      url: {
        type: DataTypes.STRING,
        allowNull: false,
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
