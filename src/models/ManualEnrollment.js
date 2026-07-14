module.exports = (sequelize, DataTypes) => {
  const ManualEnrollment = sequelize.define(
    'ManualEnrollment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      serial_number: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      udid: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('waiting', 'enrolled', 'failed'),
        defaultValue: 'waiting',
      },
      profile_uuid: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      enrolled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ManualEnrollment',
      tableName: 'manual_enrollments',
      timestamps: true,
      underscored: true,
    },
  );

  ManualEnrollment.associate = () => {};

  return ManualEnrollment;
};
