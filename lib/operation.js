const vstruct = require('varstruct');

const CreateAccountParams = vstruct([
  { name: 'address', type: vstruct.Buffer(35) },
]);

const PaymentParams = vstruct([
  { name: 'address', type: vstruct.Buffer(35) },
  { name: 'amount', type: vstruct.UInt64BE },
]);

const PostParams = vstruct([
  { name: 'content', type: vstruct.VarString(vstruct.UInt16BE) },
]);

module.exports = {
  CREATE_ACCOUNT: 1,
  PAYMENT: 2,
  POST: 3,
  CreateAccountParams,
  PaymentParams,
  PostParams,
};
