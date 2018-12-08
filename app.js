const grpc = require('grpc');
const db = require('./lib/db');
const Account = require('./lib/account');
const server = require('./lib/server');

db.sync().then(async () => {
  console.log('Database schema synced!');
  // Try to init genesis account
  const count = await Account.count();
  if (count === 0) {
    await Account.create({
      address: process.env.GENESIS_ADDRESS,
      balance: Number.MAX_SAFE_INTEGER,
      sequence: 0,
      bandwidth: 0,
    });
  }
  const port = process.env.PORT || 26658;
  server.bind(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure());
  server.start();
  console.log(`Server is listening on port ${port}`);
}).catch(console.error);
