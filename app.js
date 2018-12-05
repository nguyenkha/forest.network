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
      balance: 0,
      sequence: 0,
      bandwidth: 0,
    });
  }
  const port = process.env.PORT || 26658;
  server.listen(port);
  console.log(`Server is listening on port ${port}`);
}).catch(console.error);
