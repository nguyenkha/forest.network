const Sequelize = require('sequelize');

const db = new Sequelize(process.env.DATABASE_URL);

module.exports = db;
