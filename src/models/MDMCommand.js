module.exports = (sequelize, DataTypes) => {
  const MDMCommand = sequelize.define(
    'MDMCommand',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      command_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      device_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'devices',
          key: 'id',
        },
      },
      device_identifier: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      command_type: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'sent',
      },
      request_payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      response_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      retry_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      max_retries: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
      },
      queued_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      acknowledged_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'MDMCommand',
      tableName: 'mdm_commands',
      timestamps: true,
      underscored: true,
    },
  );

  MDMCommand.associate = (models) => {
    MDMCommand.belongsTo(models.Device, { foreignKey: 'device_id' });
  };

  return MDMCommand;
};
