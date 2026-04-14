module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define(
    'Employee',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      employee_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: 'Employee ID already exists',
        },
      },
      department: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      device_os: {
        type: DataTypes.ENUM('android', 'ios'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Employee',
      tableName: 'employees',
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  );

  Employee.associate = (models) => {
    Employee.belongsTo(models.User, { foreignKey: 'user_id' });
    Employee.hasMany(models.Device, { foreignKey: 'employee_id' });
    Employee.hasMany(models.PunchRecord, { foreignKey: 'employee_id' });
  };

  return Employee;
};
