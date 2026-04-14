module.exports = (sequelize, DataTypes) => {
  const DevicePolicy = sequelize.define(
    'DevicePolicy',
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
      policy_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      policy_details: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      applied_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'DevicePolicy',
      tableName: 'device_policies',
      timestamps: true,
      underscored: true,
    },
  );

  DevicePolicy.associate = (models) => {
    DevicePolicy.belongsTo(models.Device, { foreignKey: 'device_id' });
  };

  return DevicePolicy;
};
