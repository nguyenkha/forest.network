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

const UpdateAccountParams = vstruct([
  { name: 'name', type: vstruct.VarString(vstruct.UInt8) },
]);

module.exports = {
  CREATE_ACCOUNT: 1,
  PAYMENT: 2,
  POST: 3,
  UPDATE_ACCOUNT: 4,

  CreateAccountParams,
  PaymentParams,
  PostParams,
  UpdateAccountParams,
};
