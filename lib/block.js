const Sequelize = require('sequelize');
const db = require('./db');

const Block = db.define('block', {
  height: {
    type: Sequelize.BIGINT,
    primaryKey: true,
  },
  time: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  hash: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
  },
  appHash: {
    type: Sequelize.STRING,
    allowNull: false,
  }
});

module.exports = Block;
