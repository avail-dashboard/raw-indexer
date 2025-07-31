const { initialize, disconnect, MAINNET_ENDPOINT, SDK } = require('avail-js-sdk');

async function exploreSDK() {
  try {
    console.log('Initializing Avail SDK...');
    const api = await initialize(MAINNET_ENDPOINT);
    
    console.log('API initialized successfully');
    
    // Explore the SDK structure
    const sdk = new SDK(api);
    console.log('\nSDK structure:');
    console.log('SDK keys:', Object.keys(sdk));
    
    if (sdk.blocks) {
      console.log('sdk.blocks keys:', Object.keys(sdk.blocks));
    }
    
    if (sdk.block) {
      console.log('sdk.block keys:', Object.keys(sdk.block));
    }
    
    // Try different approaches to get a block
    const latestHeader = await api.rpc.chain.getHeader();
    const latestNumber = latestHeader.number.toNumber();
    const testBlockNumber = latestNumber - 5;
    const blockHash = await api.rpc.chain.getBlockHash(testBlockNumber);
    
    console.log(`\nTesting with block ${testBlockNumber} (hash: ${blockHash})`);
    
    // Try direct API approach
    try {
      const signedBlock = await api.rpc.chain.getBlock(blockHash);
      console.log('✓ Direct API getBlock works');
      console.log('Block structure keys:', Object.keys(signedBlock.block));
      console.log('Header keys:', Object.keys(signedBlock.block.header));
      console.log('Extrinsics count:', signedBlock.block.extrinsics.length);
    } catch (e) {
      console.log('✗ Direct API getBlock failed:', e.message);
    }
    
    // Try SDK methods
    console.log('\nTrying SDK methods...');
    
    // Check if there are other methods available
    for (const key of Object.keys(sdk)) {
      console.log(`SDK.${key}:`, typeof sdk[key]);
      if (typeof sdk[key] === 'object' && sdk[key] !== null) {
        console.log(`  ${key} methods:`, Object.keys(sdk[key]));
      }
    }
    
    await disconnect();
    console.log('\nExploration complete');
    
  } catch (error) {
    console.error('Exploration failed:', error.message);
    await disconnect();
  }
}

exploreSDK();