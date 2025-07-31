const { initialize, disconnect, MAINNET_ENDPOINT } = require('avail-js-sdk');

class SimpleAvailClient {
  constructor(rpcUrl = MAINNET_ENDPOINT, requestDelay = 1000) {
    this.rpcUrl = rpcUrl;
    this.requestDelay = requestDelay;
    this.api = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log(`Connecting to Avail using SDK at ${this.rpcUrl}...`);
      
      // Initialize the Avail API
      this.api = await initialize(this.rpcUrl);
      this.isConnected = true;
      
      // Get chain info
      const chain = await this.api.rpc.system.chain();
      const version = await this.api.rpc.system.version();
      
      console.log(`Connected to ${chain} v${version} using Avail SDK`);
      
      return this.api;
    } catch (error) {
      console.error('Failed to connect to Avail using SDK:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await disconnect();
      this.isConnected = false;
      console.log('Disconnected from Avail SDK');
    }
  }

  async getBlock(blockNumber) {
    if (!this.isConnected) {
      throw new Error('Not connected to Avail. Call connect() first.');
    }

    try {
      console.log(`Fetching block ${blockNumber} using Avail SDK...`);
      
      // Get block hash by number
      const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
      
      // Get signed block using direct API (this works!)
      const signedBlock = await this.api.rpc.chain.getBlock(blockHash);
      
      if (!signedBlock) {
        throw new Error(`Block ${blockNumber} not found`);
      }

      // Get additional data
      const header = signedBlock.block.header;
      const events = await this.api.query.system.events.at(blockHash);
      
      // Get timestamp from the first extrinsic (usually timestamp.set)
      let timestamp = new Date();
      const extrinsics = signedBlock.block.extrinsics;
      if (extrinsics && extrinsics.length > 0) {
        try {
          const firstExt = extrinsics[0];
          if (firstExt.method && firstExt.method.section === 'timestamp' && firstExt.method.method === 'set') {
            const timestampMs = firstExt.method.args[0];
            timestamp = new Date(parseInt(timestampMs.toString()));
          }
        } catch (e) {
          // Fallback to current time if timestamp extraction fails
          console.warn(`Could not extract timestamp from block ${blockNumber}, using current time`);
        }
      }

      // Get session info if available
      let sessionInfo = null;
      try {
        const sessionIndex = await this.api.query.session.currentIndex.at(blockHash);
        const validators = await this.api.query.session.validators.at(blockHash);
        sessionInfo = {
          index: sessionIndex.toNumber(),
          validators: validators.map(v => v.toString())
        };
      } catch (e) {
        // Session info might not be available
      }

      // Get spec version
      let specVersion = null;
      try {
        const runtimeVersion = await this.api.rpc.state.getRuntimeVersion(blockHash);
        specVersion = {
          specVersion: runtimeVersion.specVersion.toNumber(),
          implVersion: runtimeVersion.implVersion.toNumber(),
          implName: runtimeVersion.implName.toString(),
          authoringVersion: runtimeVersion.authoringVersion.toNumber(),
          transactionVersion: runtimeVersion.transactionVersion.toNumber()
        };
      } catch (e) {
        // Spec version might not be available
      }

      const processedBlockData = {
        hash: blockHash.toString(),
        number: blockNumber,
        parentHash: header.parentHash.toString(),
        stateRoot: header.stateRoot.toString(),
        extrinsicsRoot: header.extrinsicsRoot.toString(),
        timestamp,
        author: header.author ? header.author.toString() : null,
        extrinsics: this.parseExtrinsics(signedBlock.block.extrinsics || [], blockHash.toString()),
        events: this.parseEvents(events, blockHash.toString()),
        sessionInfo,
        specVersion
      };

      // Rate limiting
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      return processedBlockData;
      
    } catch (error) {
      console.error(`Error fetching block ${blockNumber}:`, error.message);
      throw error;
    }
  }

  parseExtrinsics(extrinsics, blockHash) {
    return extrinsics.map((ext, index) => {
      try {
        const method = ext.method || {};
        const signature = ext.signature;
        
        // Determine if extrinsic was successful
        // This is a simplified check - in reality you'd need to check events
        let success = true;
        let error = null;

        return {
          index,
          hash: ext.hash ? ext.hash.toString() : `${blockHash}_ext_${index}`,
          method: method.method || 'unknown',
          section: method.section || 'unknown',
          args: method.args ? method.args.map(arg => {
            try {
              return arg.toString();
            } catch (e) {
              return JSON.stringify(arg);
            }
          }) : [],
          signature: signature ? {
            signer: signature.signer ? signature.signer.toString() : null,
            signature: signature.signature ? signature.signature.toString() : null,
            era: signature.era ? signature.era.toString() : null,
            nonce: signature.nonce ? signature.nonce.toString() : null,
            tip: signature.tip ? signature.tip.toString() : null
          } : null,
          tip: ext.tip ? ext.tip.toString() : '0',
          success,
          error,
          version: ext.version || 4
        };
      } catch (parseError) {
        console.warn(`Error parsing extrinsic ${index}:`, parseError.message);
        return {
          index,
          hash: `${blockHash}_ext_${index}`,
          method: 'unknown',
          section: 'unknown',
          args: [],
          signature: null,
          tip: '0',
          success: false,
          error: { message: parseError.message },
          version: 4
        };
      }
    });
  }

  parseEvents(events, blockHash) {
    return events.map((record, index) => {
      try {
        const { event, phase } = record;
        
        return {
          index,
          phase: phase.toString(),
          section: event.section,
          method: event.method,
          data: event.data.map(data => {
            try {
              return data.toString();
            } catch (e) {
              return JSON.stringify(data);
            }
          }),
          topics: event.meta.topics || []
        };
      } catch (parseError) {
        console.warn(`Error parsing event ${index}:`, parseError.message);
        return {
          index,
          phase: 'unknown',
          section: 'unknown',
          method: 'unknown',
          data: [],
          topics: []
        };
      }
    });
  }

  async getBlockRange(startBlock, endBlock) {
    const blocks = [];
    
    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      try {
        const blockData = await this.getBlock(blockNum);
        blocks.push(blockData);
        
        console.log(`✓ Fetched block ${blockNum} (${blockData.extrinsics.length} extrinsics, ${blockData.events.length} events)`);
      } catch (error) {
        console.error(`✗ Failed to fetch block ${blockNum}:`, error.message);
        
        // Simple retry logic
        console.log(`Retrying block ${blockNum}...`);
        try {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          const blockData = await this.getBlock(blockNum);
          blocks.push(blockData);
          console.log(`✓ Retry successful for block ${blockNum}`);
        } catch (retryError) {
          console.error(`✗ Retry failed for block ${blockNum}:`, retryError.message);
          throw retryError; // Re-throw if retry fails
        }
      }
    }
    
    return blocks;
  }
}

module.exports = SimpleAvailClient;