const db = require('./lib/db');
const server = require('./lib/server');

db.sync().then(async () => {
  console.log('Database schema synced!');
  const port = process.env.PORT || 26658;
  server.listen(port);
  console.log(`Server is listening on port ${port}`);
}).catch(console.error);
