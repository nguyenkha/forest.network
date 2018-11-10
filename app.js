const lotion = require('lotion');
const path = require('path');

const rpcPort = process.env.PORT || 26657;

const app = lotion({
  initialState: {
    count: 0
  },
  logTendermint: process.env.SHOW_TENDERMINT_LOG === '1',
  rpcPort,
  p2pPort: 26656,
  abciPort: 26658,
});

// Overwrite tendermint home
app.home = path.join(__dirname, 'tendermint');

app.use(function (state, tx) {
  if (state.count === tx.nonce) {
    state.count++
  }
});

app.start()
  .then(({ GCI }) => {
    console.log('forest.network has been starting...');
    console.log('GCI:', GCI);
  })
  .catch(console.error);
