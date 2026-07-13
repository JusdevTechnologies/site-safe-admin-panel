module.exports = (sequelize, DataTypes) => {
  const CertificateMetadata = sequelize.define(
    'CertificateMetadata',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      certificate_type: {
        type: DataTypes.ENUM('identity', 'push', 'anchor'),
        allowNull: false,
      },
      display_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      uuid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      issuer: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      serial_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      not_valid_before: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      not_valid_after: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      thumbprint: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'CertificateMetadata',
      tableName: 'certificate_metadata',
      timestamps: true,
      underscored: true,
    },
  );

  CertificateMetadata.associate = () => {};

  return CertificateMetadata;
};
