const { ApiPromise, WsProvider } = require('@polkadot/api');

async function checkLatestBlock() {
  const provider = new WsProvider('wss://mainnet-rpc.avail.so/ws');
  const api = await ApiPromise.create({ provider });
  
  const latestHeader = await api.rpc.chain.getHeader();
  const latestNumber = latestHeader.number.toNumber();
  
  console.log(`Latest block number: ${latestNumber}`);
  console.log(`Suggested range: ${latestNumber - 10} to ${latestNumber - 5}`);
  
  await api.disconnect();
}

checkLatestBlock();