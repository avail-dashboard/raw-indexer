const { ApiPromise, WsProvider } = require('@polkadot/api');
const DatabaseClient = require('./database');
const config = require('./config');

async function demoInsert() {
  console.log('🔬 Demo: Inserting sample data to show database structure...');
  
  // Initialize database
  const dbClient = new DatabaseClient(config.database);
  await dbClient.connect();
  
  // Create some sample data based on what we can get from Avail
  const provider = new WsProvider('wss://mainnet-rpc.avail.so/ws');
  const api = await ApiPromise.create({ provider });
  
  const latestHeader = await api.rpc.chain.getHeader();
  const blockNumber = latestHeader.number.toNumber() - 5;
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  const header = await api.rpc.chain.getHeader(blockHash);
  
  // Insert one real header + some demo data
  const sampleBlockData = {
    hash: blockHash.toString(),
    number: header.number.toNumber(),
    parentHash: header.parentHash.toString(),
    stateRoot: header.stateRoot.toString(),
    extrinsicsRoot: header.extrinsicsRoot.toString(),
    timestamp: new Date(),
    author: null, // Avail might not expose this in the header
    extrinsics: [
      {
        index: 0,
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        method: 'set',
        section: 'timestamp',
        args: [Date.now().toString()],
        signature: null,
        tip: '0',
        success: true,
        error: null,
        version: 4
      },
      {
        index: 1,
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        method: 'transfer',
        section: 'balances',
        args: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '1000000000000'],
        signature: {
          signer: '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY',
          signature: '0x123...',
          era: '0x456...',
          nonce: '1',
          tip: '0'
        },
        tip: '0',
        success: true,
        error: null,
        version: 4
      }
    ],
    events: [
      {
        index: 0,
        phase: 'Initialization',
        section: 'system',
        method: 'ExtrinsicSuccess',
        data: ['Normal'],
        topics: []
      },
      {
        index: 1,
        phase: 'ApplyExtrinsic(1)',
        section: 'balances',
        method: 'Transfer',
        data: [
          '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY',
          '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          '1000000000000'
        ],
        topics: []
      }
    ],
    sessionInfo: {
      index: 100,
      validators: [
        '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY',
        '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
      ]
    },
    specVersion: {
      specVersion: 48,
      implVersion: 1,
      implName: 'avail-node',
      authoringVersion: 1,
      transactionVersion: 1
    }
  };
  
  console.log(`📦 Inserting sample block ${sampleBlockData.number}...`);
  await dbClient.insertBlock(sampleBlockData);
  
  // Insert a few more sample blocks
  for (let i = 1; i <= 3; i++) {
    const nextBlockData = {
      ...sampleBlockData,
      hash: `0x${i.toString().padStart(64, '0')}`,
      number: sampleBlockData.number + i,
      parentHash: i === 1 ? sampleBlockData.hash : `0x${(i-1).toString().padStart(64, '0')}`,
      timestamp: new Date(Date.now() + i * 12000), // 12 second blocks
      extrinsics: sampleBlockData.extrinsics.map(ext => ({
        ...ext,
        hash: `0x${i}${ext.hash.slice(3)}`
      }))
    };
    
    console.log(`📦 Inserting sample block ${nextBlockData.number}...`);
    await dbClient.insertBlock(nextBlockData);
  }
  
  console.log('\n✅ Sample data inserted successfully!');
  
  await api.disconnect();
  await dbClient.disconnect();
}

demoInsert().catch(console.error);