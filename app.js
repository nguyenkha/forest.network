const lotion = require('lotion');
// Enhance lotion
require('./lib/fork_lotion');
const { Transaction, UnsignedTransaction } = require('./lib/transaction');
const operation = require('./lib/operation');
const { Keypair } = require('stellar-base');
const path = require('path');
const crypto = require('crypto');
const base32 = require('base32.js');

const app = lotion({
  initialState: {
    // Default account
    accounts: {
      [process.env.GENESIS_ADDRESS]: {
        balance: Number.MAX_SAFE_INTEGER,
        sequence: 0,
        posts: {},
      },
    },
  },
  logTendermint: process.env.SHOW_TENDERMINT_LOG === '1',
  rpcPort: 26657,
  abciPort: 26658,
  p2pPort: 26656,
});

// Overwrite tendermint home
app.home = path.join(__dirname, 'tendermint');

app.use(function (state, tx) {
  const hash = crypto.createHash('sha256')
    .update(Transaction.encode(tx))
    .digest()
    .slice(0, 20)
    .toString('hex')
    .toUpperCase();

  // Account
  const accountString = base32.encode(tx.account);
  const account = state.accounts[accountString];
  if (!account) {
    throw Error('Account does not exist.');
  }

  // Sequence
  if (tx.sequence !== account.sequence + 1) {
    throw Error('Sequence does not match.');
  }

  // Memo
  if (tx.memo.length > 32) {
    throw Error('Memo has more than 32 characters.');
  }

  // Signature
  const key = Keypair.fromPublicKey(accountString);
  // Hash for sign
  const unsignedHash = crypto
    .createHash('sha256')
    .update(UnsignedTransaction.encode(tx))
    .digest();
  if (!key.verify(unsignedHash, tx.signature)) {
    throw Error('Signature can not be verified.');
  }

  // Increase account sequence
  account.sequence++;

  // Operation: create account, payment, post, comment (?), like
  if (tx.operation === operation.CREATE_ACCOUNT) {
    const { address } = operation.CreateAccountParams.decode(tx.params);
    const addressString = base32.encode(address);
    // Check the key
    Keypair.fromPublicKey(addressString);
    const found = state.accounts[addressString];
    if (found) {
      throw Error('Account address existed.');
    }
    const newAccount = {
      balance: 0,
      sequence: 0,
      posts: {},
    };
    state.accounts[addressString] = newAccount;
  } else if (tx.operation === operation.PAYMENT) {
    const { address, amount } = operation.PaymentParams.decode(tx.params);
    const addressString = base32.encode(address);
    if (address.compare(tx.account) === 0) {
      throw Error('Cannot transfer to the same address');
    }
    if (amount <= 0) {
      throw Error('Amount must be greater than 0');
    }
    if (amount > account.balance) {
      throw Error('Amount must be less or equal to source balance');
    }
    const found = state.accounts[addressString];
    if (!found) {
      throw Error('Account address does not exist.');
    }
    account.balance -= amount;
    found.balance += amount;
  } else if (tx.operation === operation.POST) {
    const { content } = operation.PostParams.decode(tx.params);
    account.posts[hash] = {
      content,
    };
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
