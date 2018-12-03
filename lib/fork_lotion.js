const ABCIServer = require('lotion/dist/abci-server');
const createServer = require('abci');
const { decode, verify } = require('./transaction');

function buildInitialInfo(initChainRequest) {
  const result = {
    validators: {}
  };
  initChainRequest.validators.forEach(validator => {
    result.validators[
      validator.pubKey.data.toString('base64')
    ] = validator.power.toNumber();
  });

  return result;
}

ABCIServer.default = function createABCIServer(stateMachine, initialState) {
    let height = 0;
    const abciServer = createServer({
      info: function (request) {
        return {};
      },
      deliverTx: function (request) {
        try {
          const tx = decode(request.tx);
          verify(tx);
          try {
            stateMachine.transition({ type: 'transaction', data: tx });
            return {};
          }
          catch (e) {
            return { code: 1, log: e.toString() };
          }
        }
        catch (e) {
          return { code: 1, log: 'Invalid transaction encoding' };
        }
      },
      checkTx: function (request) {
        try {
          const tx = decode(request.tx);
          verify(tx);
          try {
              stateMachine.check(tx);
              return {};
          }
          catch (e) {
              return { code: 1, log: e.toString() };
          }
        }
        catch (e) {
          return { code: 1, log: 'Invalid transaction encoding' };
        }
      },
      beginBlock: function (request) {
        const time = request.header.time.seconds.toNumber();
        stateMachine.transition({ type: 'begin-block', data: { time: time } });
        return {};
      },
      endBlock: function () {
        stateMachine.transition({ type: 'block', data: {} });
        const validators = stateMachine.context().validators;
        const validatorUpdates = [];
        Object.keys(validators).forEach((pubKey) => {
          validatorUpdates.push({
            pubKey: { type: 'ed25519', data: Buffer.from(pubKey, 'base64') },
            power: { low: validators[pubKey], high: 0 }
          });
        });
        height += 1;
        return {
          validatorUpdates,
        };
      },
      commit: function () {
        const data = stateMachine.commit();
        return { data: Buffer.from(data, 'hex') };
      },
      initChain: function (request) {
        const initialInfo = buildInitialInfo(request);
        stateMachine.initialize(initialState, initialInfo);
        return {};
      },
      query: function (request) {
        const path = request.path;
        // TODO: Queriable here
        const queryResponse = stateMachine.query(path);
        const value = Buffer.from(djson.stringify(queryResponse)).toString('base64');
        return {
          value,
          height,
        };
      }
  });
  return abciServer;
};
