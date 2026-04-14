module.exports = (sequelize, DataTypes) => {
  const PunchRecord = sequelize.define(
    'PunchRecord',
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
      punch_type: {
        type: DataTypes.ENUM('punch_in', 'punch_out'),
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      source_system: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'access_management',
      },
      external_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'PunchRecord',
      tableName: 'punch_records',
      timestamps: true,
      underscored: true,
    },
  );

  PunchRecord.associate = (models) => {
    PunchRecord.belongsTo(models.Employee, { foreignKey: 'employee_id' });
  };

  return PunchRecord;
};
