const createServer = require('abci');
const moment = require('moment');
const db = require('./db');
const Block = require('./block');
const { decode, verify } = require('./transaction');

let blockTransaction;

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
    blockTransaction = await db.transaction();
    // Add block to db
    await Block.create({
      height,
      hash,
      time,
    }, { transaction: blockTransaction });
    return {};
  },
  async endBlock(req) {
    const height = req.height.toString();
    // Check with height in database
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
      transaction: blockTransaction
    });
    if (latestBlock.height !== height) {
      throw Error('End block height mismatched');
    }
    return {};
  },
  async commit(req) {
    // Check with height in database
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
      transaction: blockTransaction
    });
    await blockTransaction.commit();
    return {
      data: Buffer.from(latestBlock.hash),
    };
  },
  async checkTx(req) {
    req.parsedTx = decode(req.tx);
  },
  async deliverTx(req) {
    await checkTx(req);

  }
});

module.exports = server;
