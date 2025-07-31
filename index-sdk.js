#!/usr/bin/env node

const config = require('./config');
const AvailSDKClient = require('./avail-sdk-client');
const DatabaseClient = require('./database');

class AvailSDKIndexer {
  constructor() {
    this.availClient = null;
    this.dbClient = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      // Validate configuration
      config.validate();

      // Initialize Avail SDK client
      this.availClient = new AvailSDKClient(
        config.avail.rpcUrl,
        config.avail.requestDelay
      );

      // Initialize database client
      this.dbClient = new DatabaseClient(config.database);

      console.log('🚀 Avail SDK Indexer initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize indexer:', error.message);
      process.exit(1);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Indexer is already running');
      return;
    }

    try {
      this.isRunning = true;
      console.log('\n📡 Starting Avail blockchain indexer with SDK...');
      
      // Connect to services
      await this.availClient.connect();
      await this.dbClient.connect();

      // Get block range from configuration
      const { startBlock, endBlock } = config.avail;
      const totalBlocks = endBlock - startBlock + 1;
      
      console.log(`\n🔍 Indexing blocks ${startBlock} to ${endBlock} (${totalBlocks} blocks)\n`);

      // Track timing
      const startTime = Date.now();
      let processedBlocks = 0;

      // Process blocks sequentially
      for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
        if (!this.isRunning) {
          console.log('\n⏹️  Indexing stopped by user');
          break;
        }

        try {
          console.log(`Processing block ${blockNum}...`);
          
          // Fetch block data from Avail using SDK
          const blockData = await this.availClient.getBlock(blockNum);
          
          // Insert into database
          await this.dbClient.insertBlock(blockData);
          
          processedBlocks++;
          
          // Progress update
          const progress = ((processedBlocks / totalBlocks) * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const blocksPerSec = (processedBlocks / (elapsed || 1)).toFixed(2);
          
          console.log(`  📊 Progress: ${progress}% (${processedBlocks}/${totalBlocks}) | ${blocksPerSec} blocks/sec | ${elapsed}s elapsed\n`);
          
        } catch (error) {
          console.error(`❌ Failed to process block ${blockNum}:`, error.message);
          
          // Stop on critical errors, continue on minor ones
          if (error.message.includes('Connection') || error.message.includes('ECONNREFUSED')) {
            console.error('💥 Critical connection error, stopping indexer');
            break;
          }
          
          // For other errors, try to continue with next block
          console.log(`⚠️  Skipping block ${blockNum} and continuing...`);
        }
      }

      // Final statistics
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgBlocksPerSec = (processedBlocks / (totalTime || 1)).toFixed(2);
      
      console.log('\n📈 Final Statistics:');
      console.log(`  • Processed: ${processedBlocks}/${totalBlocks} blocks`);
      console.log(`  • Total time: ${totalTime} seconds`);
      console.log(`  • Average speed: ${avgBlocksPerSec} blocks/second`);
      
      // Database statistics
      const dbStats = await this.dbClient.getStats();
      console.log(`  • Database records:`);
      console.log(`    - Blocks: ${dbStats.blocks}`);
      console.log(`    - Extrinsics: ${dbStats.extrinsics}`);
      console.log(`    - Events: ${dbStats.events}`);
      console.log(`    - Transfers: ${dbStats.transfers}`);
      console.log(`    - Block range: ${dbStats.min_block} - ${dbStats.max_block}`);

      console.log('\n✅ Indexing completed successfully!');
      
    } catch (error) {
      console.error('💥 Indexer failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  async stop() {
    console.log('\n⏹️  Stopping indexer...');
    this.isRunning = false;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up connections...');
    
    if (this.availClient) {
      await this.availClient.disconnect();
    }
    
    if (this.dbClient) {
      await this.dbClient.disconnect();
    }
    
    console.log('✅ Cleanup complete');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
  
  if (global.indexer) {
    await global.indexer.stop();
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
  
  if (global.indexer) {
    await global.indexer.stop();
  } else {
    process.exit(0);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Main execution
async function main() {
  console.log('🌟 Avail Blockchain SDK Indexer v1.0.0');
  console.log('==========================================\n');
  
  // Create and run indexer
  const indexer = new AvailSDKIndexer();
  global.indexer = indexer; // For graceful shutdown
  
  await indexer.initialize();
  await indexer.start();
}

// Run only if this is the main module
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = AvailSDKIndexer;