const Sequelize = require('sequelize');
const db = require('./db');

const Account = db.define('account', {
  address: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  balance: {
    type: Sequelize.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  sequence: {
    type: Sequelize.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  bandwidth: {
    type: Sequelize.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
});

module.exports = Account;
