const createServer = require('abci');
const moment = require('moment');
const Decimal = require('decimal.js');
const db = require('./db');
const Block = require('./block');
const Account = require('./account');
const { decode, verify } = require('./transaction');

const server = createServer({
  async info(req) {
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
    });
    if (latestBlock) {
      return {
        lastBlockHeight: latestBlock.height,
        // Use block hash as app hash
        lastBlockAppHash: Buffer.from(latestBlock.hash),
      };
    }
    return {
      lastBlockHeight: 0,
      // Not use app hash
      lastBlockAppHash: Buffer.alloc(0),
    }
  },
  async beginBlock(req) {
    const hash = req.hash.toString('hex').toUpperCase();
    const height = req.header.height.toString();
    const time = moment
      .unix(req.header.time.seconds.toNumber())
      .toDate();
    console.log(`Begin block ${height} hash ${hash}`);
    this.blockTransaction = await db.transaction();
    // Add block to db
    await Block.create({
      height,
      hash,
      time,
    }, { transaction: this.blockTransaction });
    return {};
  },
  async endBlock(req) {
    const height = req.height.toString();
    // Check with height in database
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
      transaction: this.blockTransaction
    });
    if (latestBlock.height !== height) {
      throw Error('End block height mismatched');
    }
    console.log('End block');
    return {};
  },
  async commit(req) {
    // Check with height in database
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
      transaction: this.blockTransaction
    });
    await this.blockTransaction.commit();
    return {
      data: Buffer.from(latestBlock.hash),
    };
  },
  async executeTx(req, dbTransaction) {
    const tx = decode(req.tx);
    const { operation } = tx;
    // Check signature
    if (!verify(tx)) {
      throw Error('Wrong signature');
    }
    // Check account
    const account = await Account.findById(tx.account, { transaction: dbTransaction });
    if (!account) {
      throw Error('Account does not exists');
    }
    // Check sequence
    if (!(new Decimal(account.sequence).add(1).equals(tx.sequence))) {
      throw Error('Sequence mismatch');
    }
    if (tx.memo.length > 32) {
      throw Error('Memo has more than 32 bytes.');
    }
    if (operation === 'create_account') {
      const { address } = tx.params;
      const found = await Account.findById(address, { transaction: dbTransaction });
      if (found) {
        throw Error('Account address existed');
      }
      await Account.create({
        address,
        balance: 0,
        sequence: 0,
        bandwidth: 0,
      }, { transaction: dbTransaction });
    } else if (operation === 'payment') {
      const { address, amount } = tx.params;
      const found = await Account.findById(address, { transaction: dbTransaction });
      if (!found) {
        throw Error('Destination address does not exist');
      }
      if (address === tx.account) {
        throw Error('Cannot transfer to the same address');
      }
      if (amount <= 0) {
        throw Error('Amount must be greater than 0');
      }
      if (new Decimal(amount).gt(account.balance)) {
        throw Error('Amount must be less or equal to source balance');
      }
      found.balance += amount;
      account.balance -= amount;
      await found.save({ transaction: dbTransaction });
      await account.save({ transaction: dbTransaction });
    } else {
      throw Error('Operation is not support.');
    }
    const tags = [];
    // Tag by source account and to account
    if (tx.account) {
      tags.push({ key: Buffer.from('account'), value: Buffer.from(tx.account) });
    }
    if (tx.params && tx.params.address) {
      tags.push({ key: Buffer.from('account'), value: Buffer.from(tx.params.address) });
    }
    tx.tags = tags;
    return tx;
  },
  async checkTx(req) {
    // Create new transaction then rollback to old state
    const checkTransaction = await db.transaction();
    try {
      const tx = await this.executeTx(req, checkTransaction);
      await checkTransaction.rollback();
      return {
        tags: tx.tags,
      };
    } catch (err) {
      await checkTransaction.rollback();
      return { code: 1, log: err.toString() };
    }
  },
  async deliverTx(req) {
    // Execute within block db transaction
    const deliverTransaction = await db.transaction({
      transaction: this.blockTransaction,
    });
    try {
      const tx = await this.executeTx(req, deliverTransaction);
      await deliverTransaction.commit();
      return {
        tags: tx.tags,
      };
    } catch (err) {
      await deliverTransaction.rollback();
      return { code: 1, log: err.toString() };
    }
  }
});

module.exports = server;
