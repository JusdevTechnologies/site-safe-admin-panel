module.exports = (sequelize, DataTypes) => {
  const AdeEnrollment = sequelize.define(
    'AdeEnrollment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      device_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'devices',
          key: 'id',
        },
      },
      serial_number: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      udid: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      model: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile_uuid: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'enrollment_profiles',
          key: 'profile_uuid',
        },
      },
      organization: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'assigned',
          'enrollment_started',
          'checkin_received',
          'mdm_connection',
          'completed',
          'failed',
        ),
        defaultValue: 'pending',
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      enrolled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'AdeEnrollment',
      tableName: 'ade_enrollments',
      timestamps: true,
      underscored: true,
    },
  );

  AdeEnrollment.associate = (models) => {
    AdeEnrollment.belongsTo(models.Device, {
      foreignKey: 'device_id',
      allowNull: true,
    });
    AdeEnrollment.belongsTo(models.EnrollmentProfile, {
      foreignKey: 'profile_uuid',
      targetKey: 'profile_uuid',
      allowNull: true,
    });
  };

  return AdeEnrollment;
};
