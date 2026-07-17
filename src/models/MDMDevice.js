module.exports = (sequelize, DataTypes) => {
  const MDMDevice = sequelize.define(
    'MDMDevice',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      udid: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      serial_number: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      model: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      os_version: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      enrollment_status: {
        type: DataTypes.ENUM('enrolled', 'not_found', 'pending'),
        defaultValue: 'pending',
      },
      enrollment_type: {
        type: DataTypes.ENUM('device', 'user'),
        allowNull: true,
      },
      push_token_status: {
        type: DataTypes.ENUM('valid', 'invalid', 'unknown'),
        defaultValue: 'unknown',
      },
      camera_state: {
        type: DataTypes.ENUM('restricted', 'unrestricted', 'unknown'),
        defaultValue: 'unknown',
      },
      last_seen: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_sync_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      device_info: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'MDMDevice',
      tableName: 'mdm_devices',
      timestamps: true,
      underscored: true,
    },
  );

  MDMDevice.associate = () => {};

  return MDMDevice;
};
