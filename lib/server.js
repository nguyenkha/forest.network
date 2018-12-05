const createServer = require('abci');
const moment = require('moment');
const Decimal = require('decimal.js');
const crypto = require('crypto');
const db = require('./db');
const Block = require('./block');
const Account = require('./account');
const { decode, verify, hash } = require('./transaction');

// 24 hours
const BANDWIDTH_PERIOD = 86400;
const INITIAL_APP_HASH = Buffer.from('forest.network by Kha Do');
const ACCOUNT_KEY = Buffer.from('account');
const MAX_BLOCK_SIZE = 22020096;
const RESERVE_RATIO = 1;
const MAX_CELLULOSE = Number.MAX_SAFE_INTEGER;
const NETWORK_BANDWIDTH = RESERVE_RATIO * MAX_BLOCK_SIZE * BANDWIDTH_PERIOD;

const server = createServer({
  async info(req) {
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
    });
    if (latestBlock) {
      return {
        lastBlockHeight: latestBlock.height,
        lastBlockAppHash: Buffer.from(latestBlock.appHash, 'hex'),
      };
    }
    return {
      lastBlockHeight: 0,
      lastBlockAppHash: INITIAL_APP_HASH,
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
    const previousBlock = await Block.findOne({
      order: [['time', 'DESC']],
    }, { transaction: this.blockTransaction });
    this.appHash = previousBlock ? Buffer.from(previousBlock.appHash, 'hex') : INITIAL_APP_HASH;
    // Add block to db
    this.currentBlock = { height, hash, time };
    return {};
  },

  async endBlock(_req) {
    console.log('End block');
    await Block.create({
      ...this.currentBlock,
      appHash: this.appHash.toString('hex').toUpperCase(),
    }, { transaction: this.blockTransaction });
    return {};
  },

  async commit(_req) {
    console.log(`Commit block with app hash ${this.appHash.toString('hex')}`);
    await this.blockTransaction.commit();
    return {
      data: this.appHash,
    };
  },

  async executeTx(req, dbTransaction, isCheckTx) {
    if (isCheckTx) {
      console.log('Check tx');
    } else {
      console.log('Deliver tx');
    }
    const tx = decode(req.tx);
    const txSize = req.tx.length;
    tx.hash = hash(tx);
    const { operation } = tx;
    // Check signature
    if (!verify(tx)) {
      throw Error('Wrong signature');
    }
    // Check account
    const account = await Account.findByPk(tx.account, { transaction: dbTransaction });
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
    if (this.currentBlock) {
      const diff = account.bandwidthTime
        ? moment(this.currentBlock.time).unix() - moment(account.bandwidthTime).unix()
        : BANDWIDTH_PERIOD;
      const bandwidthLimit = account.balance / MAX_CELLULOSE * NETWORK_BANDWIDTH;
      // 24 hours window max 65kB
      account.bandwidth = Math.ceil(Math.max(0, (BANDWIDTH_PERIOD - diff) / BANDWIDTH_PERIOD) * account.bandwidth + txSize);
      if (account.bandwidth > bandwidthLimit) {
        throw Error('Bandwidth limit exceeded');
      }
      // Check bandwidth
      account.bandwidthTime = this.currentBlock.time;
    }
    await account.save({ transaction: dbTransaction });

    // Process operation
    if (operation === 'create_account') {
      const { address } = tx.params;
      const found = await Account.findByPk(address, { transaction: dbTransaction });
      if (found) {
        throw Error('Account address existed');
      }
      await Account.create({
        address,
        balance: 0,
        sequence: 0,
        bandwidth: 0,
      }, { transaction: dbTransaction });
      console.log(`${tx.hash}: ${account.address} created ${address}`);
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
      found.balance = new Decimal(found.balance).add(amount).toFixed();
      account.balance = new Decimal(account.balance).sub(amount).toFixed();
      await found.save({ transaction: dbTransaction });
      await account.save({ transaction: dbTransaction });
      console.log(`${tx.hash}: ${account.address} transfered ${amount} to ${address}`);
    } else {
      throw Error('Operation is not support.');
    }

    // Check bandwidth usage < account balance
    const blockedAmount = Math.ceil(account.bandwidth / NETWORK_BANDWIDTH * MAX_CELLULOSE);
    console.log('Blocked amount:', blockedAmount);
    if (new Decimal(account.balance).lt(blockedAmount)) {
      throw Error('Account balance must greater blocked amount due to bandwidth used');
    }

    // Tag by source account and to account
    const tags = [];
    if (tx.account) {
      tags.push({ key: ACCOUNT_KEY, value: Buffer.from(tx.account) });
    }
    if (tx.params && tx.params.address) {
      tags.push({ key: ACCOUNT_KEY, value: Buffer.from(tx.params.address) });
    }
    tx.tags = tags;
    return tx;
  },

  async checkTx(req) {
    // Create new transaction then rollback to old state
    const checkTransaction = await db.transaction();
    try {
      const tx = await this.executeTx(req, checkTransaction, true);
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
      // Update app hash
      this.appHash = crypto.createHash('sha256')
        .update(Buffer.concat([this.appHash, Buffer.from(tx.hash, 'hex')]))
        .digest();
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
