module.exports = (sequelize, DataTypes) => {
  const NotificationLog = sequelize.define(
    'NotificationLog',
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
      notification_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('sent', 'delivered', 'failed', 'pending'),
        defaultValue: 'pending',
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      response: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fcm_message_id: {
        type: DataTypes.STRING(512),
        allowNull: true,
        comment: 'Firebase Cloud Messaging message ID returned on successful send',
      },
      retry_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      delivered_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'NotificationLog',
      tableName: 'notification_logs',
      timestamps: true,
      underscored: true,
    },
  );

  NotificationLog.associate = (models) => {
    NotificationLog.belongsTo(models.Device, { foreignKey: 'device_id' });
  };

  return NotificationLog;
};
