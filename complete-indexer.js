#!/usr/bin/env node

const config = require('./config');
const CompleteAvailClient = require('./complete-avail-client');
const CompleteDatabaseClient = require('./complete-database');

class CompleteAvailIndexer {
  constructor() {
    this.availClient = null;
    this.dbClient = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      config.validate();

      this.availClient = new CompleteAvailClient(
        config.avail.rpcUrl,
        config.avail.requestDelay
      );

      this.dbClient = new CompleteDatabaseClient(config.database);

      console.log('🚀 Complete Avail Indexer initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize complete indexer:', error.message);
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
      console.log('\n📡 Starting COMPLETE Avail blockchain indexer...');
      console.log('📋 Extracting ALL entities from introspectionSchema.json\n');
      
      await this.availClient.connect();
      await this.dbClient.connect();

      const { startBlock, endBlock } = config.avail;
      const totalBlocks = endBlock - startBlock + 1;
      
      console.log(`🔍 Indexing blocks ${startBlock} to ${endBlock} (${totalBlocks} blocks)`);
      console.log('📊 Extracting: Blocks, Extrinsics, Events, Transfers, AccountEntities,');
      console.log('   AccounToUpdateValues, HeaderExtensions, AppLookups, Commitments,');
      console.log('   DataSubmissions, Logs, Sessions, SpecVersions\n');

      const startTime = Date.now();
      let processedBlocks = 0;

      for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
        if (!this.isRunning) {
          console.log('\n⏹️  Indexing stopped by user');
          break;
        }

        try {
          console.log(`Processing complete block ${blockNum}...`);
          
          // Fetch ALL entity data from Avail
          const completeBlockData = await this.availClient.getCompleteBlockData(blockNum);
          
          // Log what we extracted
          this.logExtractedData(completeBlockData);
          
          // Insert ALL entities into database
          await this.dbClient.insertCompleteBlock(completeBlockData);
          
          processedBlocks++;
          
          const progress = ((processedBlocks / totalBlocks) * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const blocksPerSec = (processedBlocks / (elapsed || 1)).toFixed(2);
          
          console.log(`  📊 Progress: ${progress}% (${processedBlocks}/${totalBlocks}) | ${blocksPerSec} blocks/sec | ${elapsed}s elapsed\n`);
          
        } catch (error) {
          console.error(`❌ Failed to process complete block ${blockNum}:`, error.message);
          
          if (error.message.includes('Connection') || error.message.includes('ECONNREFUSED')) {
            console.error('💥 Critical connection error, stopping indexer');
            break;
          }
          
          console.log(`⚠️  Skipping block ${blockNum} and continuing...\n`);
        }
      }

      // Final comprehensive statistics
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgBlocksPerSec = (processedBlocks / (totalTime || 1)).toFixed(2);
      
      console.log('\n📈 Final Comprehensive Statistics:');
      console.log(`  • Processed: ${processedBlocks}/${totalBlocks} blocks`);
      console.log(`  • Total time: ${totalTime} seconds`);
      console.log(`  • Average speed: ${avgBlocksPerSec} blocks/second`);
      
      const completeStats = await this.dbClient.getCompleteStats();
      console.log(`  • Complete Database Records:`);
      console.log(`    - Blocks: ${completeStats.blocks}`);
      console.log(`    - Extrinsics: ${completeStats.extrinsics}`);
      console.log(`    - Events: ${completeStats.events}`);
      console.log(`    - Transfers: ${completeStats.transfers}`);
      console.log(`    - Account Entities: ${completeStats.account_entities}`);
      console.log(`    - Account Updates: ${completeStats.account_updates}`);
      console.log(`    - Header Extensions: ${completeStats.header_extensions}`);
      console.log(`    - App Lookups: ${completeStats.app_lookups}`);
      console.log(`    - Commitments: ${completeStats.commitments}`);
      console.log(`    - Data Submissions: ${completeStats.data_submissions}`);
      console.log(`    - Logs: ${completeStats.logs}`);
      console.log(`    - Sessions: ${completeStats.sessions}`);
      console.log(`    - Spec Versions: ${completeStats.spec_versions}`);
      console.log(`    - Block range: ${completeStats.min_block} - ${completeStats.max_block}`);

      console.log('\n🎉 COMPLETE indexing with ALL entities finished successfully!');
      
    } catch (error) {
      console.error('💥 Complete indexer failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  logExtractedData(blockData) {
    const counts = {
      extrinsics: blockData.extrinsics?.length || 0,
      events: blockData.events?.length || 0,
      headerExtensions: blockData.headerExtensions?.length || 0,
      appLookups: blockData.appLookups?.length || 0,
      commitments: blockData.commitments?.length || 0,
      logs: blockData.logs?.length || 0,
      accountUpdates: blockData.accountUpdates?.length || 0,
      dataSubmissions: blockData.dataSubmissions?.length || 0
    };

    console.log(`  📝 Extracted: ${counts.extrinsics} ext, ${counts.events} events, ${counts.headerExtensions} header-ext,`);
    console.log(`     ${counts.appLookups} app-lookups, ${counts.commitments} commitments, ${counts.logs} logs,`);
    console.log(`     ${counts.accountUpdates} account-updates, ${counts.dataSubmissions} data-submissions`);
  }

  async stop() {
    console.log('\n⏹️  Stopping complete indexer...');
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
  console.log('🌟 Complete Avail Blockchain Indexer v2.0.0');
  console.log('============================================');
  console.log('📋 ALL ENTITIES from introspectionSchema.json');
  console.log('============================================\n');
  
  const indexer = new CompleteAvailIndexer();
  global.indexer = indexer;
  
  await indexer.initialize();
  await indexer.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = CompleteAvailIndexer;