const environment = require('./environment');

const dbConfig = {
  development: {
    username: environment.database.username,
    password: environment.database.password,
    database: environment.database.name,
    host: environment.database.host,
    port: environment.database.port,
    dialect: environment.database.dialect,
    logging: environment.database.logging,
    pool: environment.database.pool,
    seederStorage: 'sequelize',
    timestamps: true,
    underscored: true,
  },
  production: {
    username: environment.database.username,
    password: environment.database.password,
    database: environment.database.name,
    host: environment.database.host,
    port: environment.database.port,
    dialect: environment.database.dialect,
    logging: false,
    pool: environment.database.pool,
    seederStorage: 'sequelize',
    timestamps: true,
    underscored: true,
    ssl: true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
  test: {
    username: 'postgres',
    password: 'postgres',
    database: 'mdm_admin_panel_test',
    host: 'localhost',
    dialect: 'postgres',
    logging: false,
  },
};

module.exports = dbConfig;
