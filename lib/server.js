const createServer = require('abci');
const moment = require('moment');
const Decimal = require('decimal.js');
const db = require('./db');
const Block = require('./block');
const Account = require('./account');
const { decode, verify } = require('./transaction');

// 24 hours
const BANDWIDTH_PERIOD = 86400;
const BANDWIDTH_LIMIT = 65536;

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
      data: Buffer.alloc(0),
    };
  },

  async executeTx(req, dbTransaction) {
    const tx = decode(req.tx);
    const txSize = req.tx.length;
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
    const nextSequence = new Decimal(account.sequence).add(1);
    if (!nextSequence.equals(tx.sequence)) {
      throw Error('Sequence mismatch');
    }
    account.sequence = nextSequence.toFixed();
    // Check memo
    if (tx.memo.length > 32) {
      throw Error('Memo has more than 32 bytes.');
    }
    // Update bandwidth
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
      transaction: dbTransaction,
    });
    if (latestBlock && account.bandwidthTime) {
      const diff = moment(latestBlock.time).unix() - moment(account.bandwidthTime).unix();
      // 24 hours window max 65kB
      account.bandwidth = Math.max(0, (BANDWIDTH_PERIOD - diff) / BANDWIDTH_PERIOD) * account.bandwidth + txSize;
      if (account.bandwidth > BANDWIDTH_LIMIT) {
        throw Error('Bandwidth limit exceeded');
      }
      // Check bandwidth
      account.bandwidthTime = latestBlock.time;
      await account.save({ transaction: dbTransaction });
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
    // Tag by source account and to account
    const tags = [];
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
      return {};
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
