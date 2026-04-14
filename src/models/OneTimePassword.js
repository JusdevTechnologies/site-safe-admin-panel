module.exports = (sequelize, DataTypes) => {
  const OneTimePassword = sequelize.define(
    'OneTimePassword',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      device_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'devices',
          key: 'id',
        },
      },
      otp_code: {
        type: DataTypes.STRING(8),
        allowNull: false,
        comment: '8-digit OTP code',
      },
      purpose: {
        type: DataTypes.ENUM('device_uninstall'),
        allowNull: false,
        defaultValue: 'device_uninstall',
      },
      is_used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      used_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      attempt_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      max_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
      },
    },
    {
      sequelize,
      modelName: 'OneTimePassword',
      tableName: 'one_time_passwords',
      timestamps: true,
      underscored: true,
    },
  );

  OneTimePassword.associate = (models) => {
    OneTimePassword.belongsTo(models.Device, { foreignKey: 'device_id' });
  };

  return OneTimePassword;
};
