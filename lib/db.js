const Sequelize = require('sequelize');

const db = new Sequelize(process.env.DATABASE_URL, {
  logging: process.env.SHOW_SEQUELIZE_LOG,
});

module.exports = db;
