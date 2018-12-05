#!/usr/bin/env node

const { Keypair } = require('stellar-base');
const { createHash } = require('crypto')

const key = Keypair.random();
console.log('Secret key:', key.secret());
console.log('Public key:', key.publicKey());

console.log('Secret key (base64):', key._secretKey.toString('base64'));
console.log('Public key (base64):', key._publicKey.toString('base64'));
console.log('Tenermint address:', createHash('sha256')
  .update(key._publicKey)
  .digest().slice(0, 20)
  .toString('hex')
  .toUpperCase());