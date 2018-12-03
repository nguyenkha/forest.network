const vstruct = require('varstruct');

const attrs = [
  { name: 'account', type: vstruct.VarString(vstruct.UInt8) },
  { name: 'sequence', type: vstruct.UInt64BE },
  { name: 'memo', type: vstruct.VarString(vstruct.UInt8) },
  { name: 'operation', type: vstruct.VarString(vstruct.UInt8) },
  { name: 'params', type: vstruct.VarBuffer(vstruct.UInt16BE) },
];

const UnsignedTransaction = vstruct(attrs);

const Transaction = vstruct(attrs.concat([
  { name: 'signature', type: vstruct.VarBuffer(vstruct.UInt8) },
]));

module.exports = { Transaction, UnsignedTransaction };
