// Main Avail DA Explorer Indexer
// Orchestrates complete pipeline with comprehensive data extraction and analytics

require('dotenv').config();
const { AvailExplorerExtractor } = require('./explorer-extractor');
const { ExplorerDatabase } = require('./explorer-database');
const { ExplorerAnalytics } = require('./explorer-analytics');

class AvailExplorerIndexer {
    constructor() {
        this.extractor = new AvailExplorerExtractor();
        this.database = new ExplorerDatabase();
        this.analytics = new ExplorerAnalytics();
        
        this.config = {
            startBlock: parseInt(process.env.START_BLOCK) || 0,
            endBlock: parseInt(process.env.END_BLOCK) || 100,
            requestDelay: parseInt(process.env.REQUEST_DELAY) || 500,
            batchSize: 5, // Process blocks in batches for better performance
            maxRetries: 3,
            resumeOnError: true
        };

        this.stats = {
            startTime: null,
            endTime: null,
            totalBlocks: 0,
            successfulBlocks: 0,
            failedBlocks: 0,
            totalExtrinsics: 0,
            totalEvents: 0,
            totalApiCalls: 0,
            errors: []
        };

        this.isRunning = false;
        this.shouldStop = false;
        this.lastProcessedBlock = null;
        this.processingQueue = [];
    }

    // Main indexing process
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Indexer is already running');
            return;
        }

        console.log('\n🚀 Starting Avail DA Explorer Indexer');
        console.log('=====================================');
        console.log(`📊 Block range: ${this.config.startBlock} → ${this.config.endBlock}`);
        console.log(`⏱️ Request delay: ${this.config.requestDelay}ms`);
        console.log(`📦 Batch size: ${this.config.batchSize}`);
        console.log('');

        this.isRunning = true;
        this.stats.startTime = Date.now();

        try {
            // Initialize connections
            await this.initialize();

            // Check for resume point
            const resumeBlock = await this.determineStartBlock();
            console.log(`🔄 Starting from block ${resumeBlock}`);

            // Process block range
            await this.processBlockRange(resumeBlock, this.config.endBlock);

            // Generate final statistics
            await this.generateFinalStatistics();

            console.log('\n✅ Indexing completed successfully!');

        } catch (error) {
            console.error('\n❌ Indexing failed:', error.message);
            this.stats.errors.push({
                type: 'FATAL',
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        } finally {
            this.isRunning = false;
            await this.cleanup();
        }
    }

    // Initialize all components
    async initialize() {
        console.log('🔧 Initializing components...');
        
        // Connect to Avail network
        await this.extractor.connect();
        
        // Test database connection
        const dbHealthy = await this.database.healthCheck();
        if (!dbHealthy) {
            throw new Error('Database connection failed');
        }
        console.log('✅ Database connection verified');

        // Setup signal handlers for graceful shutdown
        this.setupSignalHandlers();
        
        console.log('✅ All components initialized');
    }

    // Determine starting block (clean block boundaries)
    async determineStartBlock() {
        try {
            const lastProcessed = await this.database.getLastProcessedBlock();
            
            if (lastProcessed !== null) {
                console.log(`📍 Found last processed block: ${lastProcessed}`);
                const nextBlock = lastProcessed + 1;
                if (nextBlock <= this.config.endBlock) {
                    console.log(`🔄 Resuming from block ${nextBlock}`);
                    return nextBlock;
                } else {
                    console.log(`✅ All blocks in range already processed`);
                    return this.config.endBlock + 1; // Will cause immediate completion
                }
            }
            
            console.log(`🆕 Starting fresh from block ${this.config.startBlock}`);
            return this.config.startBlock;
        } catch (error) {
            console.warn(`⚠️ Could not determine resume point: ${error.message}`);
            console.log(`🔄 Defaulting to start block ${this.config.startBlock}`);
            return this.config.startBlock;
        }
    }

    // Process a range of blocks
    async processBlockRange(startBlock, endBlock) {
        const totalBlocks = endBlock - startBlock + 1;
        console.log(`\n🔄 Processing ${totalBlocks} blocks...`);

        let currentBlock = startBlock;
        let previousBlockData = null;

        while (currentBlock <= endBlock && !this.shouldStop) {
            const batchStart = currentBlock;
            const batchEnd = Math.min(currentBlock + this.config.batchSize - 1, endBlock);
            
            console.log(`\n📦 Processing batch: blocks ${batchStart} → ${batchEnd}`);
            
            // Process batch with parallel extraction but sequential storage
            for (let blockNum = batchStart; blockNum <= batchEnd && !this.shouldStop; blockNum++) {
                try {
                    const blockData = await this.processBlock(blockNum, previousBlockData);
                    previousBlockData = blockData;
                    this.lastProcessedBlock = blockNum;
                    
                    // Progress reporting
                    const progress = ((blockNum - startBlock + 1) / totalBlocks * 100).toFixed(1);
                    console.log(`  ✅ Block ${blockNum} processed (${progress}%)`);
                    
                } catch (error) {
                    console.error(`  ❌ Block ${blockNum} failed: ${error.message}`);
                    this.stats.failedBlocks++;
                    this.stats.errors.push({
                        type: 'BLOCK_ERROR',
                        blockNumber: blockNum,
                        message: error.message,
                        timestamp: new Date().toISOString()
                    });

                    if (!this.config.resumeOnError) {
                        throw error;
                    }
                }

                // Rate limiting
                if (this.config.requestDelay > 0 && !this.shouldStop) {
                    await this.sleep(this.config.requestDelay);
                }
            }

            currentBlock = batchEnd + 1;

            // Batch statistics
            console.log(`📊 Batch completed - Success: ${this.stats.successfulBlocks}, Failed: ${this.stats.failedBlocks}`);
        }

        if (this.shouldStop) {
            console.log('⏹️ Processing stopped by user request');
        } else {
            console.log(`\n🎉 Block range processing completed!`);
        }
    }

    // Process a single block with complete data extraction and storage
    async processBlock(blockNumber, previousBlockData = null) {
        const blockStartTime = Date.now();
        console.log(`  🔍 Checking if block ${blockNumber} already exists...`);
        
        // Check if block already exists (atomic check)
        const blockExists = await this.database.blockExists(blockNumber);
        if (blockExists) {
            console.log(`  ✅ Block ${blockNumber} already processed, skipping`);
            // Still need to return block data for previousBlockData chain
            try {
                const blockData = await this.extractor.extractCompleteBlockData(blockNumber);
                return blockData;
            } catch (error) {
                console.warn(`  ⚠️ Could not extract existing block ${blockNumber} data for chaining: ${error.message}`);
                return null;
            }
        }
        
        try {
            console.log(`  📊 Extracting block ${blockNumber} data...`);
            // Extract comprehensive block data
            const blockData = await this.extractor.extractCompleteBlockData(blockNumber);
            
            console.log(`  🧮 Calculating analytics for block ${blockNumber}...`);
            // Calculate analytics and statistics
            const networkStats = this.analytics.calculateNetworkStatistics(blockData, previousBlockData);
            const blockAnalytics = this.analytics.calculateBlockAnalytics(blockData, networkStats);

            console.log(`  💾 Storing block ${blockNumber} in transaction...`);
            // Store ALL data in single atomic transaction
            await this.database.withTransaction(async (client) => {
                await this.storeCompleteBlockData(blockData, networkStats, blockAnalytics, client);
            });

            // Update statistics
            this.updateProcessingStats(blockData);
            console.log(`  ✅ Block ${blockNumber} fully processed and committed`);
            
            return blockData;

        } catch (error) {
            console.error(`  ❌ Block ${blockNumber} processing failed: ${error.message}`);
            console.error(`     Will retry on next run (transaction rolled back)`);
            throw error;
        }
    }

    // Store complete block data in database within transaction
    async storeCompleteBlockData(blockData, networkStats, blockAnalytics, client = null) {
        const { header, extrinsics, events, storage, kate, accounts } = blockData;

        // 1. Store block header
        const blockHeaderData = {
            blockNumber: header.number,
            blockHash: blockData.blockHash,
            parentHash: header.parentHash,
            stateRoot: header.stateRoot,
            extrinsicsRoot: header.extrinsicsRoot,
            timestamp: blockData.timestamp,
            authorAccount: networkStats.validators?.blockAuthor,
            isFinalized: false, // Would need additional logic to determine
            extrinsicsCount: extrinsics.length,
            eventsCount: events.length,
            dataSubmissionsCount: networkStats.dataAvailability?.dataSubmissions || 0,
            totalFees: networkStats.fees?.totalFees || '0',
            totalTips: networkStats.fees?.totalTips || '0',
            specVersion: blockData.runtime?.runtimeVersion?.specVersion,
            implVersion: blockData.runtime?.runtimeVersion?.implVersion,
            authoringVersion: blockData.runtime?.runtimeVersion?.authoringVersion,
            transactionVersion: blockData.runtime?.runtimeVersion?.transactionVersion,
            stateVersion: blockData.runtime?.runtimeVersion?.stateVersion,
            digestJson: header.digest,
            headerRawHex: header.raw
        };

        await this.database.insertBlockHeader(blockHeaderData, client);

        // 2. Store Kate commitment data
        if (kate && kate.blockLength) {
            const kateData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                rows: kate.blockLength.rows || null,
                cols: kate.blockLength.cols || null,
                blockLength: kate.blockLength.blockLength || 0,
                commitmentHex: kate.commitmentHex || null,
                proofData: kate.sampleDataProof || null,
                utilizationPercentage: networkStats.dataAvailability?.blockUtilization || 0,
                appDataCount: networkStats.dataAvailability?.uniqueApps || 0
            };

            await this.database.insertKateCommitment(kateData, client);
        }

        // 3. Store extrinsics
        const extrinsicIds = {};
        for (const ext of extrinsics) {
            const extrinsicData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                extrinsicIndex: ext.index,
                extrinsicHash: ext.hash,
                isSigned: ext.isSigned,
                signerAccount: ext.signature?.signer,
                methodPallet: ext.method.pallet,
                methodName: ext.method.name,
                nonce: ext.signature?.nonce,
                tip: ext.signature?.tip,
                fee: 0, // Would need to extract from events
                success: this.determineExtrinsicSuccess(ext.index, events),
                methodArgs: ext.method.args,
                signatureData: ext.signature,
                eraData: ext.signature?.era,
                rawHex: ext.rawHex,
                lengthBytes: ext.length
            };

            const extrinsicId = await this.database.insertExtrinsic(extrinsicData, client);
            extrinsicIds[ext.index] = extrinsicId;
        }

        // 4. Store events
        const eventIds = {};
        for (const event of events) {
            const extrinsicIndex = this.extractExtrinsicIndex(event.phase);
            const eventData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                eventIndex: event.index,
                extrinsicId: extrinsicIndex !== null ? extrinsicIds[extrinsicIndex] : null,
                extrinsicIndex: extrinsicIndex,
                phaseType: this.getPhaseType(event.phase),
                phaseValue: this.getPhaseValue(event.phase),
                pallet: event.pallet,
                eventName: event.eventName,
                eventData: event.data,
                topics: event.topics,
                rawData: event.rawData
            };

            const eventId = await this.database.insertEvent(eventData, client);
            eventIds[event.index] = eventId;

            // Link extrinsics to events
            if (eventData.extrinsicId) {
                await this.database.linkExtrinsicEvent(eventData.extrinsicId, eventId, client);
            }
        }

        // 5. Store account data
        if (accounts && accounts.accounts) {
            for (const account of accounts.accounts) {
                const accountProfileData = {
                    accountId: account.accountId,
                    currentNonce: account.nonce,
                    currentBalanceFree: account.balance.free,
                    currentBalanceReserved: account.balance.reserved,
                    currentBalanceFrozen: account.balance.frozen,
                    isValidator: false, // Would need additional logic
                    isNominator: false,
                    firstSeenBlock: header.number,
                    firstSeenTimestamp: blockData.timestamp,
                    lastActivityBlock: header.number,
                    lastActivityTimestamp: blockData.timestamp
                };

                await this.database.upsertAccountProfile(accountProfileData, client);

                // Store balance history
                const balanceHistoryData = {
                    accountId: account.accountId,
                    blockHash: blockData.blockHash,
                    blockNumber: header.number,
                    balanceFree: account.balance.free,
                    balanceReserved: account.balance.reserved,
                    balanceFrozen: account.balance.frozen,
                    nonce: account.nonce,
                    consumers: account.consumers,
                    providers: account.providers,
                    sufficients: 0 // Would need to extract from storage
                };

                await this.database.insertBalanceHistory(balanceHistoryData, client);
            }
        }

        // 6. Store transfer events
        const transferEvents = this.extractTransferEvents(events, eventIds);
        for (const transfer of transferEvents) {
            const transferData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                extrinsicId: transfer.extrinsicId,
                eventId: transfer.eventId,
                fromAccount: transfer.from,
                toAccount: transfer.to,
                amount: transfer.amount,
                transferType: transfer.type,
                success: true
            };

            await this.database.insertTransferEvent(transferData, client);
        }

        // 7. Store data submissions
        const dataSubmissions = this.extractDataSubmissions(events, extrinsicIds, eventIds);
        for (const submission of dataSubmissions) {
            const submissionData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                extrinsicId: submission.extrinsicId,
                appId: submission.appId,
                submitterAccount: submission.submitter,
                dataSize: submission.dataSize,
                dataIndex: submission.dataIndex,
                submissionFee: submission.fee || 0
            };

            await this.database.insertDataSubmission(submissionData, client);
        }

        // 8. Store network statistics
        const statsData = {
            blockNumber: header.number,
            blockHash: blockData.blockHash,
            blockTimeMs: networkStats.timing?.blockTimeMs,
            finalizationDelayMs: null,
            totalExtrinsics: networkStats.block.totalExtrinsics,
            successfulExtrinsics: networkStats.block.successfulExtrinsics,
            failedExtrinsics: networkStats.block.failedExtrinsics,
            totalEvents: networkStats.block.totalEvents,
            totalFeesCollected: networkStats.fees?.totalFees || '0',
            totalTipsCollected: networkStats.fees?.totalTips || '0',
            averageFee: networkStats.fees?.avgFee || '0',
            totalDataSubmissions: networkStats.dataAvailability?.dataSubmissions || 0,
            totalDataSize: networkStats.dataAvailability?.totalDataSize || 0,
            daUtilizationPercentage: networkStats.dataAvailability?.blockUtilization || 0,
            activeAccounts: networkStats.accounts?.accountActivity?.uniqueSigners || 0,
            newAccounts: 0, // Would need additional logic
            totalIssuance: storage?.balances?.totalIssuance || '0',
            activeValidators: networkStats.validators?.activeValidators
        };

        await this.database.insertNetworkStatistics(statsData, client);

        // 9. Store block analytics
        const analyticsData = {
            blockNumber: header.number,
            blockHash: blockData.blockHash,
            tps: blockAnalytics.performance?.tps || 0,
            bps: blockAnalytics.performance?.bps || 0,
            feePercentiles: blockAnalytics.fees?.percentiles,
            gasUsageStats: null, // Avail doesn't use gas
            appSpaceUtilization: blockAnalytics.dataAvailability?.appDistribution,
            dataEfficiencyRatio: blockAnalytics.dataAvailability?.efficiency,
            blockProductionTimeMs: networkStats.timing?.blockTimeMs,
            validatorPerformance: null
        };

        await this.database.insertBlockAnalytics(analyticsData, client);
    }

    // Extract specific event types for specialized storage
    extractTransferEvents(events, eventIds) {
        const transfers = [];
        
        for (const event of events) {
            if (event.pallet === 'balances' && event.eventName === 'Transfer') {
                if (event.data && event.data.length >= 3) {
                    transfers.push({
                        eventId: eventIds[event.index],
                        from: event.data[0],
                        to: event.data[1],
                        amount: event.data[2],
                        type: 'Transfer'
                    });
                }
            }
        }
        
        return transfers;
    }

    extractDataSubmissions(events, extrinsicIds, eventIds) {
        const submissions = [];
        
        for (const event of events) {
            if (event.pallet === 'dataAvailability' && 
                (event.eventName === 'DataSubmitted' || event.eventName === 'Submitted')) {
                
                const extrinsicIndex = this.extractExtrinsicIndex(event.phase);
                
                submissions.push({
                    eventId: eventIds[event.index],
                    extrinsicId: extrinsicIndex !== null ? extrinsicIds[extrinsicIndex] : null,
                    appId: event.data && event.data[0] ? event.data[0] : 0,
                    submitter: event.data && event.data[1] ? event.data[1] : null,
                    dataSize: event.data && event.data[2] ? parseInt(event.data[2]) : 0,
                    dataIndex: null // Would need additional extraction
                });
            }
        }
        
        return submissions;
    }

    // Helper methods for data extraction
    determineExtrinsicSuccess(extrinsicIndex, events) {
        // Check if there's a failure event for this extrinsic
        const failureEvent = events.find(event => 
            event.phase && 
            this.extractExtrinsicIndex(event.phase) === extrinsicIndex &&
            event.pallet === 'system' && 
            event.eventName === 'ExtrinsicFailed'
        );
        
        return !failureEvent;
    }

    extractExtrinsicIndex(phase) {
        if (phase && typeof phase === 'object') {
            if (phase.ApplyExtrinsic !== undefined) {
                return phase.ApplyExtrinsic;
            }
            if (phase.applyExtrinsic !== undefined) {
                return phase.applyExtrinsic;
            }
        }
        return null;
    }

    getPhaseType(phase) {
        if (phase && typeof phase === 'object') {
            const keys = Object.keys(phase);
            return keys.length > 0 ? keys[0] : null;
        }
        return null;
    }

    getPhaseValue(phase) {
        if (phase && typeof phase === 'object') {
            const values = Object.values(phase);
            return values.length > 0 ? values[0] : null;
        }
        return null;
    }

    // Update processing statistics
    updateProcessingStats(blockData) {
        this.stats.totalBlocks++;
        this.stats.successfulBlocks++;
        this.stats.totalExtrinsics += blockData.extrinsics.length;
        this.stats.totalEvents += blockData.events.length;
        this.stats.totalApiCalls += blockData.extractionMeta?.totalApiCalls || 0;
    }

    // Generate final statistics and reports
    async generateFinalStatistics() {
        this.stats.endTime = Date.now();
        const duration = this.stats.endTime - this.stats.startTime;
        
        console.log('\n📊 FINAL STATISTICS');
        console.log('==================');
        console.log(`⏱️ Total time: ${(duration / 1000).toFixed(2)}s`);
        console.log(`📦 Blocks processed: ${this.stats.successfulBlocks}/${this.stats.totalBlocks}`);
        console.log(`📋 Extrinsics processed: ${this.stats.totalExtrinsics.toLocaleString()}`);
        console.log(`🎯 Events processed: ${this.stats.totalEvents.toLocaleString()}`);
        console.log(`📞 Total API calls: ${this.stats.totalApiCalls.toLocaleString()}`);
        console.log(`⚡ Avg blocks/sec: ${(this.stats.successfulBlocks / (duration / 1000)).toFixed(2)}`);
        
        if (this.stats.failedBlocks > 0) {
            console.log(`❌ Failed blocks: ${this.stats.failedBlocks}`);
            console.log(`📋 Error rate: ${(this.stats.failedBlocks / this.stats.totalBlocks * 100).toFixed(2)}%`);
        }

        // Database statistics
        const dbStats = await this.database.getProcessingStatistics();
        console.log('\n💾 DATABASE STATISTICS');
        console.log('======================');
        Object.entries(dbStats).forEach(([key, value]) => {
            console.log(`${key}: ${value.toLocaleString()}`);
        });

        // Analytics summary
        const analyticsSummary = this.analytics.getSummaryStatistics();
        console.log('\n📈 ANALYTICS SUMMARY');
        console.log('===================');
        console.log(`Avg block time: ${analyticsSummary.blockProcessing?.avgBlockTime?.toFixed(0)}ms`);
        console.log(`Fee trend: ${analyticsSummary.fees?.recentTrend}`);
        console.log(`Avg utilization: ${analyticsSummary.utilization?.avgUtilization?.toFixed(1)}%`);
        console.log(`Avg DA utilization: ${analyticsSummary.utilization?.avgDAUtilization?.toFixed(1)}%`);
    }

    // Utility methods
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupSignalHandlers() {
        process.on('SIGINT', () => {
            console.log('\n⏹️ Received SIGINT, stopping gracefully...');
            this.shouldStop = true;
        });

        process.on('SIGTERM', () => {
            console.log('\n⏹️ Received SIGTERM, stopping gracefully...');
            this.shouldStop = true;
        });
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...');
        
        try {
            await this.extractor.disconnect();
            await this.database.close();
            console.log('✅ Cleanup completed');
        } catch (error) {
            console.error('⚠️ Cleanup error:', error.message);
        }
    }

    // Public methods for external control
    stop() {
        console.log('🛑 Stop requested');
        this.shouldStop = true;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            shouldStop: this.shouldStop,
            lastProcessedBlock: this.lastProcessedBlock,
            stats: { ...this.stats },
            config: { ...this.config }
        };
    }

    // Resume from a specific block
    async resume(fromBlock = null) {
        if (fromBlock) {
            this.config.startBlock = fromBlock;
        }
        await this.start();
    }
}

// Main execution when run directly
async function main() {
    const indexer = new AvailExplorerIndexer();
    
    try {
        await indexer.start();
    } catch (error) {
        console.error('💥 Indexer crashed:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { AvailExplorerIndexer };