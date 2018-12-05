const createServer = require('abci');
const moment = require('moment');
const db = require('./db');
const Block = require('./block');

const appHash = Buffer.alloc(0);

let blockTransaction;

const server = createServer({
  async info(req) {
    const latestBlock = await Block.findOne({
      order: [['time', 'DESC']],
    });
    if (latestBlock) {
      return {
        lastBlockHeight: latestBlock.height,
        // Not use app hash
        lastBlockAppHash: appHash,
      };
    }
    return {
      lastBlockHeight: 0,
      // Not use app hash
      lastBlockAppHash: appHash,
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
    // Write block to db
    await Block.create({
      height,
      hash,
      time,
    }, { transaction: blockTransaction });
  },
});

module.exports = server;
