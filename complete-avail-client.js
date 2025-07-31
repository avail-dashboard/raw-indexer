const { initialize, disconnect, MAINNET_ENDPOINT } = require('avail-js-sdk');

class CompleteAvailClient {
  constructor(rpcUrl = MAINNET_ENDPOINT, requestDelay = 1000) {
    this.rpcUrl = rpcUrl;
    this.requestDelay = requestDelay;
    this.api = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log(`Connecting to Avail using SDK at ${this.rpcUrl}...`);
      
      this.api = await initialize(this.rpcUrl);
      this.isConnected = true;
      
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

  async getCompleteBlockData(blockNumber) {
    if (!this.isConnected) {
      throw new Error('Not connected to Avail. Call connect() first.');
    }

    try {
      console.log(`Fetching complete block data for ${blockNumber}...`);
      
      const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
      const signedBlock = await this.api.rpc.chain.getBlock(blockHash);
      const header = signedBlock.block.header;
      const events = await this.api.query.system.events.at(blockHash);
      
      // Extract timestamp
      let timestamp = new Date();
      const extrinsics = signedBlock.block.extrinsics;
      if (extrinsics && extrinsics.length > 0) {
        try {
          const firstExt = extrinsics[0];
          if (firstExt.method?.section === 'timestamp' && firstExt.method?.method === 'set') {
            timestamp = new Date(parseInt(firstExt.method.args[0].toString()));
          }
        } catch (e) {
          console.warn(`Could not extract timestamp from block ${blockNumber}`);
        }
      }

      // Get all entity data
      const [
        sessionInfo,
        specVersion,
        headerExtensions,
        appLookups,
        commitments,
        logs,
        accountUpdates,
        dataSubmissions
      ] = await Promise.all([
        this.extractSessionInfo(blockHash),
        this.extractSpecVersion(blockHash),
        this.extractHeaderExtensions(blockHash, header),
        this.extractAppLookups(blockHash),
        this.extractCommitments(blockHash, header),
        this.extractLogs(events),
        this.extractAccountUpdates(events, extrinsics, blockNumber),
        this.extractDataSubmissions(events, extrinsics, blockNumber)
      ]);

      const completeBlockData = {
        // Basic block data
        hash: blockHash.toString(),
        number: blockNumber,
        parentHash: header.parentHash.toString(),
        stateRoot: header.stateRoot.toString(),
        extrinsicsRoot: header.extrinsicsRoot.toString(),
        timestamp,
        author: header.author ? header.author.toString() : null,
        
        // Parsed transactions and events
        extrinsics: this.parseExtrinsics(extrinsics || [], blockHash.toString()),
        events: this.parseEvents(events, blockHash.toString()),
        
        // All entities
        sessionInfo,
        specVersion,
        headerExtensions,
        appLookups,
        commitments,
        logs,
        accountUpdates,
        dataSubmissions
      };

      // Rate limiting
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      return completeBlockData;
      
    } catch (error) {
      console.error(`Error fetching complete block ${blockNumber}:`, error.message);
      throw error;
    }
  }

  async extractSessionInfo(blockHash) {
    try {
      const sessionIndex = await this.api.query.session.currentIndex.at(blockHash);
      const validators = await this.api.query.session.validators.at(blockHash);
      return {
        index: sessionIndex.toNumber(),
        validators: validators.map(v => v.toString())
      };
    } catch (e) {
      return null;
    }
  }

  async extractSpecVersion(blockHash) {
    try {
      const runtimeVersion = await this.api.rpc.state.getRuntimeVersion(blockHash);
      return {
        specVersion: runtimeVersion.specVersion.toNumber(),
        implVersion: runtimeVersion.implVersion.toNumber(),
        implName: runtimeVersion.implName.toString(),
        authoringVersion: runtimeVersion.authoringVersion.toNumber(),
        transactionVersion: runtimeVersion.transactionVersion.toNumber()
      };
    } catch (e) {
      return null;
    }
  }

  async extractHeaderExtensions(blockHash, header) {
    const extensions = [];
    
    try {
      // Extract from digest logs
      if (header.digest && header.digest.logs) {
        for (let i = 0; i < header.digest.logs.length; i++) {
          const log = header.digest.logs[i];
          try {
            const logStr = log.toString();
            
            // Check if this is a DA-related log
            if (logStr.includes('Other') || logStr.includes('0x') || logStr.length > 100) {
              extensions.push({
                hash: `${blockHash}_ext_${i}`,
                logIndex: i,
                logType: this.detectLogType(logStr),
                data: logStr,
                commitmentData: this.extractCommitmentFromLog(logStr),
                appLookupData: this.extractAppLookupFromLog(logStr)
              });
            }
          } catch (e) {
            // Skip unparseable logs
          }
        }
      }
    } catch (e) {
      console.warn('Error extracting header extensions:', e.message);
    }
    
    return extensions;
  }

  async extractAppLookups(blockHash) {
    const lookups = [];
    
    try {
      if (this.api.query.dataAvailability) {
        const appKeys = await this.api.query.dataAvailability.appKeys.entriesAt(blockHash);
        
        appKeys.forEach(([key, value], index) => {
          try {
            const appIdRaw = key.args[0];
            const ownerData = value.toString();
            
            // Parse owner data (usually JSON format)
            let parsedOwner = {};
            try {
              parsedOwner = JSON.parse(ownerData);
            } catch (e) {
              parsedOwner = { raw: ownerData };
            }
            
            lookups.push({
              appId: appIdRaw.toString(),
              appIdHex: appIdRaw.toHex ? appIdRaw.toHex() : appIdRaw.toString(),
              appIdDecoded: this.decodeAppId(appIdRaw),
              owner: parsedOwner.owner || ownerData,
              id: parsedOwner.id || index,
              size: 0, // Will be calculated if available
              indexValue: index
            });
          } catch (e) {
            console.warn(`Error parsing app lookup ${index}:`, e.message);
          }
        });
      }
    } catch (e) {
      console.warn('Error extracting app lookups:', e.message);
    }
    
    return lookups;
  }

  async extractCommitments(blockHash, header) {
    const commitments = [];
    
    try {
      // Extract from header digest (Kate commitments are usually here)
      if (header.digest && header.digest.logs) {
        header.digest.logs.forEach((log, index) => {
          try {
            const logStr = log.toString();
            
            // Look for commitment-like data (long hex strings, specific patterns)
            if (this.isCommitmentLog(logStr)) {
              commitments.push({
                commitment: this.extractCommitmentValue(logStr),
                length: logStr.length,
                logIndex: index,
                commitmentType: this.detectCommitmentType(logStr)
              });
            }
          } catch (e) {
            // Skip unparseable logs
          }
        });
      }
    } catch (e) {
      console.warn('Error extracting commitments:', e.message);
    }
    
    return commitments;
  }

  extractLogs(events) {
    const logs = [];
    
    events.forEach((record, index) => {
      const { event } = record;
      
      // Extract system logs
      if (event.section === 'system') {
        logs.push({
          logType: 'system',
          engine: event.method,
          data: {
            method: event.method,
            data: event.data.map(d => d.toString()),
            eventIndex: index
          }
        });
      }
      
      // Extract other notable logs
      if (['treasury', 'staking', 'session', 'grandpa', 'babe'].includes(event.section)) {
        logs.push({
          logType: event.section,
          engine: event.method,
          data: {
            method: event.method,
            section: event.section,
            data: event.data.map(d => d.toString()),
            eventIndex: index
          }
        });
      }
    });
    
    return logs;
  }

  async extractAccountUpdates(events, extrinsics, blockNumber) {
    const updates = [];
    
    // Extract from events
    events.forEach((record, index) => {
      const { event } = record;
      
      if (event.section === 'balances') {
        updates.push({
          type: 'balance_event',
          blockNumber,
          eventIndex: index,
          method: event.method,
          data: event.data.map(d => d.toString()),
          updateData: {
            section: 'balances',
            method: event.method,
            eventData: event.data.map(d => d.toString())
          }
        });
      }
      
      if (event.section === 'system' && ['NewAccount', 'KilledAccount'].includes(event.method)) {
        updates.push({
          type: 'account_lifecycle',
          blockNumber,
          eventIndex: index,
          method: event.method,
          data: event.data.map(d => d.toString()),
          updateData: {
            account: event.data[0]?.toString(),
            action: event.method
          }
        });
      }
    });
    
    // Extract from extrinsics that affect accounts
    extrinsics.forEach((ext, index) => {
      if (ext.method?.section === 'balances' || ext.method?.section === 'staking') {
        updates.push({
          type: 'extrinsic_account_update',
          blockNumber,
          extrinsicIndex: index,
          method: ext.method.method,
          data: ext.method.args || [],
          updateData: {
            section: ext.method.section,
            method: ext.method.method,
            args: ext.method.args || []
          }
        });
      }
    });
    
    return updates;
  }

  async extractDataSubmissions(events, extrinsics, blockNumber) {
    const submissions = [];
    
    // Extract from dataAvailability events
    events.forEach((record, index) => {
      const { event } = record;
      
      if (event.section === 'dataAvailability') {
        submissions.push({
          eventIndex: index,
          method: event.method,
          appId: event.data[1]?.toString() || '0',
          dataLength: event.data[2]?.toString() || '0',
          submitter: event.data[0]?.toString(),
          eventData: event.data.map(d => d.toString())
        });
      }
    });
    
    // Extract from submitData extrinsics
    extrinsics.forEach((ext, index) => {
      if (ext.method?.section === 'dataAvailability' && ext.method?.method === 'submitData') {
        submissions.push({
          extrinsicIndex: index,
          method: 'submitData',
          appId: ext.method.args[0]?.toString() || '0',
          dataLength: ext.method.args[1]?.length || 0,
          submitter: ext.signature?.signer,
          extrinsicData: ext.method.args || []
        });
      }
    });
    
    return submissions;
  }

  // Helper methods
  detectLogType(logStr) {
    if (logStr.includes('Kate') || logStr.includes('commitment')) return 'kate_commitment';
    if (logStr.includes('App') || logStr.includes('lookup')) return 'app_lookup';
    if (logStr.includes('Other')) return 'other';
    return 'unknown';
  }

  extractCommitmentFromLog(logStr) {
    // Extract commitment data patterns from log
    const commitmentMatch = logStr.match(/0x[a-fA-F0-9]{64,}/);
    return commitmentMatch ? commitmentMatch[0] : null;
  }

  extractAppLookupFromLog(logStr) {
    // Extract app lookup patterns from log
    try {
      if (logStr.includes('appId') || logStr.includes('App')) {
        return { extracted: true, log: logStr };
      }
    } catch (e) {
      // Skip
    }
    return null;
  }

  isCommitmentLog(logStr) {
    return logStr.length > 64 && 
           (logStr.includes('0x') || logStr.includes('commitment') || logStr.includes('Kate'));
  }

  extractCommitmentValue(logStr) {
    const hexMatch = logStr.match(/0x[a-fA-F0-9]+/);
    return hexMatch ? hexMatch[0] : logStr.substring(0, 100);
  }

  detectCommitmentType(logStr) {
    if (logStr.includes('Kate')) return 'kate';
    if (logStr.includes('commitment')) return 'da_commitment';
    return 'unknown';
  }

  decodeAppId(appIdRaw) {
    try {
      const hex = appIdRaw.toHex ? appIdRaw.toHex() : appIdRaw.toString();
      if (hex.startsWith('0x')) {
        const bytes = Buffer.from(hex.slice(2), 'hex');
        const decoded = bytes.toString('utf8').replace(/\0/g, '');
        return decoded.length > 0 ? decoded : hex;
      }
      return hex;
    } catch (e) {
      return appIdRaw.toString();
    }
  }

  parseExtrinsics(extrinsics, blockHash) {
    return extrinsics.map((ext, index) => {
      try {
        const method = ext.method || {};
        const signature = ext.signature;
        
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
          success: true, // Will be determined by events
          error: null,
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
}

module.exports = CompleteAvailClient;