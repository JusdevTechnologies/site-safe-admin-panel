module.exports = (sequelize, DataTypes) => {
  const Device = sequelize.define(
    'Device',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      employee_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'id',
        },
      },
      device_identifier: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: 'Device identifier already exists',
        },
      },
      device_os: {
        type: DataTypes.ENUM('android', 'ios'),
        allowNull: false,
      },
      device_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'blocked', 'lost'),
        defaultValue: 'active',
      },
      camera_blocked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      last_sync: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      device_info: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Device',
      tableName: 'devices',
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  );

  Device.associate = (models) => {
    Device.belongsTo(models.Employee, { foreignKey: 'employee_id' });
    Device.hasMany(models.DevicePolicy, { foreignKey: 'device_id' });
    Device.hasMany(models.NotificationLog, { foreignKey: 'device_id' });
  };

  return Device;
};
