#!/usr/bin/env node

const { Keypair } = require('stellar-base');

const key = Keypair.random();
console.log(key.secret());
console.log(key.publicKey());
