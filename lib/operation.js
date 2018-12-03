const vstruct = require('varstruct');

const CreateAccount = vstruct([
  { name: 'address', type: vstruct.VarString(vstruct.UInt8) },
]);

const Payment = vstruct([
  { name: 'address', type: vstruct.VarString(vstruct.UInt8) },
  { name: 'amount', type: vstruct.UInt64BE },
]);

module.exports = { CreateAccount, Payment };
