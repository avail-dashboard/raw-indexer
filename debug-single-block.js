const AvailSDKClient = require('./avail-sdk-client');
const DatabaseClient = require('./database');
const config = require('./config');

async function debugSingleBlock() {
  const availClient = new AvailSDKClient(config.avail.rpcUrl, 500);
  const dbClient = new DatabaseClient(config.database);
  
  try {
    await availClient.connect();
    await dbClient.connect();
    
    console.log('Fetching block 150000...');
    const blockData = await availClient.getBlock(150000);
    
    console.log('\nBlock data structure:');
    console.log(`- Hash: ${blockData.hash}`);
    console.log(`- Number: ${blockData.number}`);
    console.log(`- Extrinsics: ${blockData.extrinsics.length}`);
    console.log(`- Events: ${blockData.events.length}`);
    console.log(`- Avail DA data: ${JSON.stringify(blockData.availDAData, null, 2)}`);
    console.log(`- Account updates: ${JSON.stringify(blockData.accountUpdates, null, 2)}`);
    
    console.log('\nAttempting to insert...');
    await dbClient.insertBlock(blockData);
    
    console.log('✅ Success!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await availClient.disconnect();
    await dbClient.disconnect();
  }
}

debugSingleBlock();