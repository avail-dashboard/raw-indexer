const { ApiPromise, WsProvider } = require('@polkadot/api');

async function simpleTest() {
  const provider = new WsProvider('wss://mainnet-rpc.avail.so/ws');
  const api = await ApiPromise.create({ provider });
  
  console.log('Connected to Avail');
  
  // Try to get just a block header first
  const latestHeader = await api.rpc.chain.getHeader();
  const blockNumber = latestHeader.number.toNumber();
  console.log(`Latest block: ${blockNumber}`);
  
  // Try to get block hash
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber - 5);
  console.log(`Block hash for ${blockNumber - 5}: ${blockHash}`);
  
  // Try to get just the header for that block
  const header = await api.rpc.chain.getHeader(blockHash);
  console.log(`Block ${blockNumber - 5} header:`, {
    number: header.number.toNumber(),
    hash: blockHash.toString(),
    parentHash: header.parentHash.toString(),
    stateRoot: header.stateRoot.toString(),
    extrinsicsRoot: header.extrinsicsRoot.toString()
  });
  
  await api.disconnect();
}

simpleTest().catch(console.error);