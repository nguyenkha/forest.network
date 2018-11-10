const lotion = require('lotion');
const path = require('path');

const app = lotion({
  initialState: {
    count: 0
  },
  logTendermint: true,
});

app.home = path.join(__dirname, 'tendermint');

app.use(function (state, tx) {
  if (state.count === tx.nonce) {
    state.count++
  }
});

app.start()
  .then(({ GCI }) => {
    console.log('GCI:', GCI);
  })
  .catch(console.error);
