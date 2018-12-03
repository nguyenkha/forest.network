const lotion = require('lotion');
// Enhance lotion
require('./lib/fork_lotion');
const { hash } = require('./lib/transaction');
const path = require('path');

const app = lotion({
  initialState: {
    // Default account
    accounts: {
      [process.env.GENESIS_ADDRESS]: {
        name: process.env.GENESIS_ADDRESS,
        balance: Number.MAX_SAFE_INTEGER,
        sequence: 0,
        posts: {},
        // followings: {},
      },
    },
  },
  logTendermint: process.env.SHOW_TENDERMINT_LOG === '1',
  rpcPort: 26657,
  abciPort: 26658,
});

// Overwrite tendermint home
app.home = path.join(__dirname, 'tendermint');

app.use(function (state, tx) {
  const txHash = hash(tx);

  // Account
  const account = state.accounts[tx.account];
  if (!account) {
    throw Error('Account does not exist.');
  }

  // Sequence
  if (tx.sequence !== account.sequence + 1) {
    throw Error('Sequence does not match.');
  }

  // Memo
  if (tx.memo.length > 32) {
    throw Error('Memo has more than 32 bytes.');
  }

  // Increase account sequence
  account.sequence++;

  // Operation: create account, payment, post, comment (?), like
  if (tx.operation === 'create_account') {
    const { address } = tx.params;
    const found = state.accounts[address];
    if (found) {
      throw Error('Account address existed.');
    }
    const newAccount = {
      // Default display name
      name: address,
      balance: 0,
      sequence: 0,
      posts: {},
    };
    state.accounts[address] = newAccount;
  } else if (tx.operation === 'payment') {
    const { address, amount } = tx.params;
    if (address === tx.account) {
      throw Error('Cannot transfer to the same address');
    }
    if (amount <= 0) {
      throw Error('Amount must be greater than 0');
    }
    if (amount > account.balance) {
      throw Error('Amount must be less or equal to source balance');
    }
    const found = state.accounts[address];
    if (!found) { 
      throw Error('Account address does not exist.');
    }
    account.balance -= amount;
    found.balance += amount;
  } else if (tx.operation === 'post') {
    const { content } = tx.params;
    // Mark post by hash
    account.posts[txHash] = {
      content,
    };
  } else if (tx.operation === 'update_account') {
    const { name } = tx.params;
    if (name.length === 0) {
      throw Error('Account name cannot be empty');
    }
    account.name = name;
  } else {
    throw Error('Operation is not support.');
  }

  console.log(JSON.stringify(state));
});

app.start()
  .then(({ GCI }) => {
    console.log('forest.network has been starting...');
    console.log('GCI:', GCI);
  })
  .catch(console.error);
