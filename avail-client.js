const { ApiPromise, WsProvider } = require('@polkadot/api');

class AvailClient {
  constructor(rpcUrl, requestDelay = 1000) {
    this.rpcUrl = rpcUrl;
    this.requestDelay = requestDelay;
    this.api = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log(`Connecting to Avail at ${this.rpcUrl}...`);
      
      const provider = new WsProvider(this.rpcUrl);
      this.api = await ApiPromise.create({ provider });
      
      await this.api.isReady;
      this.isConnected = true;
      
      const chain = await this.api.rpc.system.chain();
      const version = await this.api.rpc.system.version();
      
      console.log(`Connected to ${chain} v${version}`);
      
      return this.api;
    } catch (error) {
      console.error('Failed to connect to Avail:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.api && this.isConnected) {
      await this.api.disconnect();
      this.isConnected = false;
      console.log('Disconnected from Avail');
    }
  }

  async getBlock(blockNumber) {
    if (!this.isConnected) {
      throw new Error('Not connected to Avail. Call connect() first.');
    }

    try {
      console.log(`Fetching block ${blockNumber}...`);
      
      // Get block hash by number
      const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
      
      // Get signed block
      const signedBlock = await this.api.rpc.chain.getBlock(blockHash);
      
      // Get block header with additional info
      const header = signedBlock.block.header;
      const extrinsics = signedBlock.block.extrinsics;
      
      // Get events for this block
      const events = await this.api.query.system.events.at(blockHash);
      
      // Get timestamp from extrinsics (usually first extrinsic is timestamp.set)
      let timestamp = new Date();
      for (const ext of extrinsics) {
        if (ext.method.section === 'timestamp' && ext.method.method === 'set') {
          const timestampMs = ext.method.args[0].toNumber();
          timestamp = new Date(timestampMs);
          break;
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

      const blockData = {
        hash: blockHash.toString(),
        number: header.number.toNumber(),
        parentHash: header.parentHash.toString(),
        stateRoot: header.stateRoot.toString(),
        extrinsicsRoot: header.extrinsicsRoot.toString(),
        timestamp,
        author: header.author ? header.author.toString() : null,
        extrinsics: this.parseExtrinsics(extrinsics, blockHash.toString()),
        events: this.parseEvents(events, blockHash.toString()),
        sessionInfo,
        specVersion
      };

      // Rate limiting
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      return blockData;
      
    } catch (error) {
      console.error(`Error fetching block ${blockNumber}:`, error.message);
      throw error;
    }
  }

  parseExtrinsics(extrinsics, blockHash) {
    return extrinsics.map((ext, index) => {
      const { method, signature, tip } = ext;
      
      // Determine if extrinsic was successful
      // This is a simplified check - in reality you'd need to check events
      let success = true;
      let error = null;

      return {
        index,
        hash: ext.hash.toString(),
        method: method.method,
        section: method.section,
        args: method.args.map(arg => arg.toString()),
        signature: signature ? {
          signer: signature.signer.toString(),
          signature: signature.signature.toString(),
          era: signature.era.toString(),
          nonce: signature.nonce.toString(),
          tip: signature.tip.toString()
        } : null,
        tip: tip ? tip.toString() : '0',
        success,
        error,
        version: ext.version
      };
    });
  }

  parseEvents(events, blockHash) {
    return events.map((record, index) => {
      const { event, phase } = record;
      
      return {
        index,
        phase: phase.toString(),
        section: event.section,
        method: event.method,
        data: event.data.map(data => data.toString()),
        topics: event.meta.topics || []
      };
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

module.exports = AvailClient;