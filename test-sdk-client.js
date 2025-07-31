const AvailSDKClient = require('./avail-sdk-client');

async function testSDKClient() {
  const client = new AvailSDKClient();
  
  try {
    await client.connect();
    
    // Test with a recent block first
    const latestHeader = await client.api.rpc.chain.getHeader();
    const latestNumber = latestHeader.number.toNumber();
    const testBlockNumber = latestNumber - 5;
    
    console.log(`\nTesting with block ${testBlockNumber}...`);
    const blockData = await client.getBlock(testBlockNumber);
    
    console.log('\n📊 Block Data Summary:');
    console.log(`  Block: ${blockData.number}`);
    console.log(`  Hash: ${blockData.hash}`);
    console.log(`  Timestamp: ${blockData.timestamp}`);
    console.log(`  Extrinsics: ${blockData.extrinsics.length}`);
    console.log(`  Events: ${blockData.events.length}`);
    
    if (blockData.extrinsics.length > 0) {
      console.log('\n🔗 First Extrinsic:');
      const firstExt = blockData.extrinsics[0];
      console.log(`  Method: ${firstExt.section}.${firstExt.method}`);
      console.log(`  Args: ${firstExt.args.slice(0, 2).join(', ')}${firstExt.args.length > 2 ? '...' : ''}`);
    }
    
    if (blockData.events.length > 0) {
      console.log('\n📢 First Event:');
      const firstEvent = blockData.events[0];
      console.log(`  Event: ${firstEvent.section}.${firstEvent.method}`);
      console.log(`  Phase: ${firstEvent.phase}`);
    }
    
    await client.disconnect();
    console.log('\n✅ SDK test successful!');
    
  } catch (error) {
    console.error('❌ SDK test failed:', error.message);
    console.error(error.stack);
    await client.disconnect();
  }
}

testSDKClient();