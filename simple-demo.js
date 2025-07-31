const DatabaseClient = require('./database');
const config = require('./config');

async function simpleDemoInsert() {
  console.log('🔬 Demo: Inserting sample data to show database structure...');
  
  // Initialize database
  const dbClient = new DatabaseClient(config.database);
  await dbClient.connect();
  
  // Create realistic sample data
  const sampleBlockData = {
    hash: '0xfad5ba7daeb06242e0363fb6fdb5130e3a9f1020bcf215f4659e651105176dd3',
    number: 1677830,
    parentHash: '0x71d519f2502707b1eda3e7971ccbcec98089349fc43475998bc66fe4e38000af',
    stateRoot: '0xb93fc784947d4db8693daded8908f73e982f29aad4c245506ac4d8f3c0081db6',
    extrinsicsRoot: '0xccb5cca1278d6bec67f6c531d6ddd05e44eed5b02e3b067eb8c0621ab25ded2c',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    author: '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY',
    extrinsics: [
      {
        index: 0,
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        method: 'set',
        section: 'timestamp',
        args: ['1705312200000'],
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
          signature: '0x123456789abcdef...',
          era: '0x456789...',
          nonce: '1',
          tip: '0'
        },
        tip: '0',
        success: true,
        error: null,
        version: 4
      },
      {
        index: 2,
        hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        method: 'submitData',
        section: 'dataAvailability',
        args: ['{"data": "Hello Avail DA!"}'],
        signature: {
          signer: '5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb',
          signature: '0xabc123...',
          era: '0x789abc...',
          nonce: '5',
          tip: '1000000'
        },
        tip: '1000000',
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
      },
      {
        index: 2,
        phase: 'ApplyExtrinsic(2)',
        section: 'dataAvailability',
        method: 'DataSubmitted',
        data: [
          '5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb',
          '1', // app_id
          '256' // data_length
        ],
        topics: []
      },
      {
        index: 3,
        phase: 'ApplyExtrinsic(1)',
        section: 'system',
        method: 'ExtrinsicSuccess',
        data: ['Normal'],
        topics: []
      }
    ],
    sessionInfo: {
      index: 100,
      validators: [
        '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY',
        '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        '5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb'
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
  
  // Insert a second block with different data
  const secondBlockData = {
    hash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    number: 1677831,
    parentHash: sampleBlockData.hash,
    stateRoot: '0x3333333333333333333333333333333333333333333333333333333333333333',
    extrinsicsRoot: '0x4444444444444444444444444444444444444444444444444444444444444444',
    timestamp: new Date('2024-01-15T10:30:12Z'), // 12 seconds later
    author: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    extrinsics: [
      {
        index: 0,
        hash: '0x5555555555555555555555555555555555555555555555555555555555555555',
        method: 'set',
        section: 'timestamp',
        args: ['1705312212000'],
        signature: null,
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
        method: 'NewAccount',
        data: ['5HbSgM72xVuscsopsdeG3sCSCYdAeM1Tay9p79N6ky6vwDGq'],
        topics: []
      }
    ],
    sessionInfo: null, // No session change
    specVersion: null  // Same spec version
  };
  
  console.log(`📦 Inserting sample block ${secondBlockData.number}...`);
  await dbClient.insertBlock(secondBlockData);
  
  console.log('\n✅ Sample data inserted successfully!');
  
  // Get final stats
  const stats = await dbClient.getStats();
  console.log('\n📊 Database Statistics:');
  console.log(`  • Blocks: ${stats.blocks}`);
  console.log(`  • Extrinsics: ${stats.extrinsics}`);
  console.log(`  • Events: ${stats.events}`);
  console.log(`  • Transfers: ${stats.transfers}`);
  console.log(`  • Block range: ${stats.min_block} - ${stats.max_block}`);
  
  await dbClient.disconnect();
}

simpleDemoInsert().catch(console.error);