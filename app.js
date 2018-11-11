const lotion = require('lotion');
const path = require('path');

const app = lotion({
  initialState: {
    count: 0
  },
  logTendermint: process.env.SHOW_TENDERMINT_LOG === '1',
  rpcPort: 26657,
  abciPort: 26658,
  p2pPort: 26656,
});

// Overwrite tendermint home
app.home = path.join(__dirname, 'tendermint');

app.use(function (state, tx) {
  state.count++;
});

app.start()
  .then(({ GCI }) => {
    console.log('forest.network has been starting...');
    console.log('GCI:', GCI);
  })
  .catch(console.error);
