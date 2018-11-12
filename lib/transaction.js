const vstruct = require('varstruct');

const attrs = [
  { name: 'account', type: vstruct.VarString(vstruct.UInt8) },
  { name: 'sequence', type: vstruct.UInt64BE },
  { name: 'memo', type: vstruct.VarBuffer(vstruct.UInt8) },
  { name: 'operation', type: vstruct.VarString(vstruct.UInt8) },
  { name: 'params', type: vstruct.VarBuffer(vstruct.UInt16BE) },
  { name: 'signature', type: vstruct.VarBuffer(vstruct.UInt8) },
];

const Transaction = vstruct(attrs);
// Remove signature
const UnsignedTransaction = vstruct(attrs.slice(0, attrs.length - 1));

module.exports = { Transaction, UnsignedTransaction };
