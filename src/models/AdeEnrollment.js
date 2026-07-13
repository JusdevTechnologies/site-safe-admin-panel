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
          'profile_generated',
          'profile_delivered',
          'enrollment_started',
          'authenticated',
          'checkin_received',
          'mdm_connection',
          'device_configured',
          'completed',
          'failed',
        ),
        defaultValue: 'pending',
      },
      profile_generated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      profile_delivered_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      authenticated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      device_configured_at: {
        type: DataTypes.DATE,
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
      retry_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      last_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
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
