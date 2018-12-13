const Sequelize = require('sequelize');
const db = require('./db');
const Account = require('./account');

const Transaction = db.define('transaction', {
  hash: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  author: {
    type: Sequelize.STRING,
    allowNull: false,
  }
});

Transaction.belongsTo(Account, {
  foreignKey: 'author',
});

module.exports = Transaction;
