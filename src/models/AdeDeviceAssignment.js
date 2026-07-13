module.exports = (sequelize, DataTypes) => {
  const AdeDeviceAssignment = sequelize.define(
    'AdeDeviceAssignment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      serial_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      device_family: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      model: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      os: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      assigned_server: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile_uuid: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile_status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      organization: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sync_status: {
        type: DataTypes.ENUM('pending', 'synced', 'failed'),
        defaultValue: 'pending',
      },
      sync_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sync_message: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      last_sync_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'AdeDeviceAssignment',
      tableName: 'ade_device_assignments',
      timestamps: true,
      underscored: true,
    },
  );

  AdeDeviceAssignment.associate = () => {};

  return AdeDeviceAssignment;
};
