const { initialize, disconnect, MAINNET_ENDPOINT } = require('avail-js-sdk');

async function exploreAvailData() {
  try {
    const api = await initialize(MAINNET_ENDPOINT);
    
    // Get a recent block with potential DA data
    const blockNumber = 150004; // This block had extrinsics
    const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    const header = signedBlock.block.header;
    
    console.log(`\nExploring block ${blockNumber} for Avail DA data...`);
    console.log(`Block hash: ${blockHash}`);
    
    // Explore header structure
    console.log('\n=== HEADER STRUCTURE ===');
    console.log('Header keys:', Object.keys(header));
    
    // Check for Avail-specific header extensions
    if (header.digest) {
      console.log('Header digest:', header.digest);
      console.log('Digest keys:', Object.keys(header.digest));
      if (header.digest.logs) {
        console.log('Digest logs count:', header.digest.logs.length);
        header.digest.logs.forEach((log, i) => {
          console.log(`Log ${i}:`, log.toString());
        });
      }
    }
    
    // Explore extrinsics for DA submissions
    console.log('\n=== EXTRINSICS ===');
    signedBlock.block.extrinsics.forEach((ext, i) => {
      console.log(`Extrinsic ${i}:`);
      console.log(`  Section: ${ext.method.section}`);
      console.log(`  Method: ${ext.method.method}`);
      if (ext.method.section === 'dataAvailability') {
        console.log(`  DA Extrinsic args:`, ext.method.args.map(arg => arg.toString()));
      }
      if (ext.method.section === 'system' && ext.method.method === 'fillBlock') {
        console.log(`  Fill block args:`, ext.method.args.map(arg => arg.toString()));
      }
    });
    
    // Check for DA-specific storage
    console.log('\n=== DA STORAGE CHECKS ===');
    
    // Try to get DA-specific storage items
    try {
      // Check if there are any DA-specific queries available
      console.log('Available pallet queries:');
      console.log('DataAvailability queries:', Object.keys(api.query.dataAvailability || {}));
      console.log('System queries:', Object.keys(api.query.system));
      
      // Try to get AppId-related storage
      if (api.query.dataAvailability) {
        console.log('DA pallet available!');
        
        // Try to get next app ID
        try {
          const nextAppId = await api.query.dataAvailability.nextAppId.at(blockHash);
          console.log('Next App ID:', nextAppId.toString());
        } catch (e) {
          console.log('Could not get next app ID:', e.message);
        }
        
        // Try to get app keys
        try {
          const appKeys = await api.query.dataAvailability.appKeys.entriesAt(blockHash);
          console.log('App keys count:', appKeys.length);
          appKeys.forEach(([key, value], i) => {
            console.log(`App ${i}: ${key.toString()} -> ${value.toString()}`);
          });
        } catch (e) {
          console.log('Could not get app keys:', e.message);
        }
      }
      
    } catch (e) {
      console.log('Error checking DA storage:', e.message);
    }
    
    // Get events related to DA
    console.log('\n=== DA EVENTS ===');
    const events = await api.query.system.events.at(blockHash);
    events.forEach((record, i) => {
      const { event } = record;
      if (event.section === 'dataAvailability') {
        console.log(`DA Event ${i}:`);
        console.log(`  Method: ${event.method}`);
        console.log(`  Data:`, event.data.map(d => d.toString()));
      }
    });
    
    // Check for Kate commitment (Avail's specific DA commitment scheme)
    console.log('\n=== KATE COMMITMENTS ===');
    try {
      // Try to get Kate commitment via RPC
      if (api.rpc.kate) {
        console.log('Kate RPC available!');
        
        // Try various Kate RPC methods
        try {
          const blockLength = await api.rpc.kate.blockLength(blockHash);
          console.log('Kate block length:', blockLength.toString());
        } catch (e) {
          console.log('Could not get Kate block length:', e.message);
        }
        
        try {
          const queryRows = await api.rpc.kate.queryRows([0], blockHash);
          console.log('Kate rows:', queryRows.toString());
        } catch (e) {
          console.log('Could not get Kate rows:', e.message);
        }
      } else {
        console.log('Kate RPC not available');
      }
    } catch (e) {
      console.log('Error with Kate RPC:', e.message);
    }
    
    await disconnect();
    
  } catch (error) {
    console.error('Exploration failed:', error);
    await disconnect();
  }
}

exploreAvailData();