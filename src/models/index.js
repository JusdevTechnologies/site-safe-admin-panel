const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const environment = require('../../config/environment');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  environment.database.name,
  environment.database.username,
  environment.database.password,
  {
    host: environment.database.host,
    port: environment.database.port,
    dialect: environment.database.dialect,
    logging: environment.database.logging,
    pool: environment.database.pool,
    define: {
      timestamps: true,
      underscored: true,
    },
  },
);

const db = {};

// Load all models
fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith('.js') && file !== 'index.js')
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Setup associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Test connection
sequelize
  .authenticate()
  .then(() => {
    logger.info('Database connection has been established successfully.');
  })
  .catch((err) => {
    logger.error('Unable to connect to the database:', err);
  });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
