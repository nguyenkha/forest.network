const crypto = require('crypto');

const CIPHER_ALGORITHM = 'aes-256-cbc';

function encrypt(content, key, iv) {
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv);
  return Buffer.concat([cipher.update(content), cipher.final()]);
}

function decrypt(content, key, iv) {
  const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(content), decipher.final()]);
}

module.exports = { encrypt, decrypt };
