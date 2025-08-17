// Main Avail DA Explorer Indexer
// Orchestrates complete pipeline for raw blockchain data extraction and storage

require('dotenv').config();
const { AvailExplorerExtractor } = require('./explorer-extractor');
const { ExplorerDatabase } = require('./explorer-database');

class AvailExplorerIndexer {
    constructor() {
        this.extractor = new AvailExplorerExtractor();
        this.database = new ExplorerDatabase();
        
        this.config = {
            startBlock: parseInt(process.env.START_BLOCK),
            endBlock: parseInt(process.env.END_BLOCK),
            requestDelay: parseInt(process.env.REQUEST_DELAY),
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
            // If START_BLOCK is explicitly defined, use it instead of resume logic
            if (!isNaN(this.config.startBlock)) {
                console.log(`🎯 Using explicit START_BLOCK: ${this.config.startBlock}`);
                return this.config.startBlock;
            }
            
            // If START_BLOCK is not defined, use resume logic
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
            
            console.log(`🆕 No previous data found, starting from block 1`);
            return 1; // Default to block 1 if no START_BLOCK and no previous data
        } catch (error) {
            console.warn(`⚠️ Could not determine resume point: ${error.message}`);
            if (!isNaN(this.config.startBlock)) {
                console.log(`🔄 Defaulting to explicit start block ${this.config.startBlock}`);
                return this.config.startBlock;
            }
            console.log(`🔄 Defaulting to block 1`);
            return 1;
        }
    }

    // Process a range of blocks with pipeline processing
    async processBlockRange(startBlock, endBlock) {
        const totalBlocks = endBlock - startBlock + 1;
        console.log(`\n🔄 Processing ${totalBlocks} blocks with pipeline processing...`);

        let pendingStorage = null; // Track storage operation for previous block
        
        for (let blockNum = startBlock; blockNum <= endBlock && !this.shouldStop; blockNum++) {
            try {
                // Step 1: Start extraction for current block (in parallel with previous storage)
                const extractionPromise = this.extractBlockData(blockNum);
                
                // Step 2: Wait for previous block's storage to complete (if any)
                if (pendingStorage) {
                    await pendingStorage.promise;
                    console.log(`✅ Block ${pendingStorage.blockNumber} storage completed`);
                }
                
                // Step 3: Complete extraction for current block
                const blockData = await extractionPromise;
                
                // Skip if already processed
                if (blockData.skipped) {
                    this.lastProcessedBlock = blockNum;
                    const progress = ((blockNum - startBlock + 1) / totalBlocks * 100).toFixed(1);
                    console.log(`✅ Block ${blockNum} processed (${progress}%)`);
                    continue;
                }
                
                // Step 4: Start storage for current block (don't wait)
                pendingStorage = {
                    blockNumber: blockNum,
                    promise: this.storeBlockData(blockData, blockNum)
                };
                
                this.lastProcessedBlock = blockNum;
                
                // Progress reporting
                const progress = ((blockNum - startBlock + 1) / totalBlocks * 100).toFixed(1);
                console.log(`✅ Block ${blockNum} extraction completed, storage started (${progress}%)`);
                
            } catch (error) {
                // Wait for any pending storage before handling error
                if (pendingStorage) {
                    try {
                        await pendingStorage.promise;
                    } catch (storageError) {
                        console.error(`❌ Storage error for block ${pendingStorage.blockNumber}: ${storageError.message}`);
                    }
                    pendingStorage = null;
                }
                
                console.error(`❌ Block ${blockNum} failed: ${error.message}`);
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
        }
        
        // Wait for final block's storage to complete
        if (pendingStorage) {
            await pendingStorage.promise;
            console.log(`✅ Block ${pendingStorage.blockNumber} storage completed`);
        }

        if (this.shouldStop) {
            console.log('⏹️ Processing stopped by user request');
        } else {
            console.log(`\n🎉 Block range processing completed!`);
        }
    }

    // Extract block data (RPC phase) - can run in parallel with storage of previous block
    async extractBlockData(blockNumber) {
        console.log(`  🔍 Checking if block ${blockNumber} already exists...`);
        
        // Check if block already exists (atomic check)
        const blockExists = await this.database.blockExists(blockNumber);
        if (blockExists) {
            console.log(`  ✅ Block ${blockNumber} already processed, skipping`);
            // Return minimal data - no need to extract full blockchain data for existing blocks
            return { blockNumber, skipped: true };
        }
        
        try {
            console.log(`  📊 Extracting block ${blockNumber} data...`);
            // Extract comprehensive block data
            const blockData = await this.extractor.extractCompleteBlockData(blockNumber);
            console.log(`  ✅ Block ${blockNumber} extraction completed`);
            return blockData;

        } catch (error) {
            console.error(`  ❌ Block ${blockNumber} extraction failed: ${error.message}`);
            throw error;
        }
    }
    
    // Store block data (Database phase) - can run in parallel with extraction of next block
    async storeBlockData(blockData, blockNumber) {
        try {
            console.log(`  💾 Storing block ${blockNumber} in transaction...`);
            // Store ALL data in single atomic transaction
            await this.database.withTransaction(async (client) => {
                await this.storeCompleteBlockData(blockData, client);
            });

            // Update statistics
            this.updateProcessingStats(blockData);
            console.log(`  ✅ Block ${blockNumber} storage committed`);
            
            return blockData;

        } catch (error) {
            console.error(`  ❌ Block ${blockNumber} storage failed: ${error.message}`);
            console.error(`     Will retry on next run (transaction rolled back)`);
            throw error;
        }
    }

    // Process a single block with complete data extraction and storage (legacy method for compatibility)
    async processBlock(blockNumber) {
        const blockData = await this.extractBlockData(blockNumber);
        if (blockData.skipped) {
            return blockData;
        }
        return await this.storeBlockData(blockData, blockNumber);
    }

    // Store complete block data in database within transaction
    async storeCompleteBlockData(blockData, client = null) {
        const { header, extrinsics, events, storage, kate, accounts } = blockData;

        // 1. Store block header with ALL runtime data
        const blockHeaderData = {
            blockNumber: header.number,
            blockHash: blockData.blockHash,
            parentHash: header.parentHash,
            stateRoot: header.stateRoot,
            extrinsicsRoot: header.extrinsicsRoot,
            timestamp: blockData.timestamp,
            authorAccount: null, // Basic storage without analytics
            isFinalized: false,
            extrinsicsCount: extrinsics.length,
            eventsCount: events.length,
            dataSubmissionsCount: 0, // Will count from events if needed
            totalFees: '0', // No fee calculation
            totalTips: '0', // No tip calculation
            // Runtime version data
            specVersion: blockData.runtime?.runtimeVersion?.specVersion,
            implVersion: blockData.runtime?.runtimeVersion?.implVersion,
            authoringVersion: blockData.runtime?.runtimeVersion?.authoringVersion,
            transactionVersion: blockData.runtime?.runtimeVersion?.transactionVersion,
            stateVersion: blockData.runtime?.runtimeVersion?.stateVersion,
            // NEW: Additional runtime metadata
            specName: blockData.runtime?.runtimeVersion?.specName,
            implName: blockData.runtime?.runtimeVersion?.implName,
            chainName: blockData.runtime?.chain,
            nodeVersion: blockData.runtime?.nodeVersion,
            chainProperties: blockData.runtime?.properties,
            // Header digest data (now enabled)
            digestJson: header.digest,
            headerRawHex: header.raw
        };

        // 1. & 2. Store block header and Kate commitment in parallel (independent tables)
        const independentInserts = [
            this.database.insertBlockHeader(blockHeaderData, client)
        ];

        if (kate && kate.blockLength) {
            const kateData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                rows: kate.blockLength.rows || null,
                cols: kate.blockLength.cols || null,
                blockLength: kate.blockLength.blockLength || 0,
                commitmentHex: kate.commitmentHex || null,
                proofData: kate.sampleDataProof || null,
                utilizationPercentage: 0, // No analytics calculation
                appDataCount: 0, // No analytics calculation
                // NEW: Store complete Kate data
                sampleDataProof: kate.sampleDataProof || null,
                sampleRowData: kate.sampleRowData || null,
                kateAvailable: kate.available !== undefined ? kate.available : true,
                kateExtractionNote: kate.error ? `Kate extraction error: ${kate.error}` : null
            };

            independentInserts.push(this.database.insertKateCommitment(kateData, client));
        }

        // Execute independent inserts in parallel
        await Promise.all(independentInserts);

        // 3. Store extrinsics using optimized chunked batch insertion
        const extrinsicIds = {};
        
        if (extrinsics.length > 0) {
            const chunkSize = 1000;
            
            for (let i = 0; i < extrinsics.length; i += chunkSize) {
                const chunk = extrinsics.slice(i, i + chunkSize);
                
                // Prepare batch data for this chunk
                const chunkData = chunk.map(ext => ({
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
                    rawHex: ext.rawHex,
                    lengthBytes: ext.length
                }));
                
                // Execute single batch query for entire chunk
                const chunkResults = await this.database.executeBatch(
                    chunkData,
                    'extrinsic_data',
                    ['block_hash', 'block_number', 'extrinsic_index', 'extrinsic_hash', 'is_signed', 'signer_account', 'method_pallet', 'method_name', 'nonce', 'tip', 'fee', 'success', 'error_message', 'method_args', 'raw_hex', 'length_bytes'],
                    (item) => [
                        item.blockHash,
                        this.database.prepareBigIntValue(item.blockNumber),
                        item.extrinsicIndex,
                        item.extrinsicHash,
                        item.isSigned,
                        item.signerAccount || null,
                        item.methodPallet,
                        item.methodName,
                        this.database.prepareBigIntValue(item.nonce),
                        this.database.prepareBigIntValue(item.tip || 0),
                        this.database.prepareBigIntValue(item.fee || 0),
                        item.success !== undefined ? item.success : null,
                        item.errorMessage || null,
                        item.methodArgs ? this.database.safeBigIntStringify(item.methodArgs) : null,
                        item.rawHex || null,
                        item.lengthBytes || null
                    ],
                    chunkSize,
                    'INSERT',
                    client
                );
                
                // Map results back to extrinsic indices
                chunk.forEach((ext, idx) => {
                    extrinsicIds[ext.index] = chunkResults[idx];
                });
            }
        }

        // 4. Store events using optimized chunked batch insertion
        const eventIds = {};
        
        if (events.length > 0) {
            const chunkSize = events.length > 10000 ? 500 : 1000;
            
            for (let i = 0; i < events.length; i += chunkSize) {
                const chunk = events.slice(i, i + chunkSize);
                
                // Prepare batch data for this chunk
                const chunkData = chunk.map(event => {
                    const extrinsicIndex = this.extractExtrinsicIndex(event.phase);
                    return {
                        blockHash: blockData.blockHash,
                        blockNumber: header.number,
                        eventIndex: event.index,
                        extrinsicId: extrinsicIndex !== null ? extrinsicIds[extrinsicIndex] : null,
                        extrinsicIndex: extrinsicIndex,
                        phaseType: this.getPhaseType(event.phase),
                        phaseValue: this.getPhaseValue(event.phase),
                        pallet: event.pallet,
                        eventName: event.eventName,
                        topics: event.topics,
                        rawData: event.rawData
                    };
                });
                
                // Execute single batch query for entire chunk
                const chunkResults = await this.database.executeBatch(
                    chunkData,
                    'event_data',
                    ['block_hash', 'block_number', 'event_index', 'extrinsic_id', 'extrinsic_index', 'phase_type', 'phase_value', 'pallet', 'event_name', 'topics', 'raw_data'],
                    (item) => [
                        item.blockHash,
                        this.database.prepareBigIntValue(item.blockNumber),
                        item.eventIndex,
                        item.extrinsicId || null,
                        item.extrinsicIndex || null,
                        item.phaseType || null,
                        item.phaseValue || null,
                        item.pallet,
                        item.eventName,
                        item.topics || [],
                        item.rawData ? this.database.safeBigIntStringify(item.rawData) : null
                    ],
                    chunkSize,
                    'INSERT',
                    client
                );
                
                // Map results back to event indices
                chunk.forEach((event, idx) => {
                    eventIds[event.index] = chunkResults[idx];
                });
            }
        }

        // 5. Store account data using optimized chunked batch insertion
        if (accounts && accounts.accounts && accounts.accounts.length > 0) {
            const chunkSize = 2000;
            
            for (let i = 0; i < accounts.accounts.length; i += chunkSize) {
                const chunk = accounts.accounts.slice(i, i + chunkSize);
                
                // Prepare batch data for account profiles
                const accountProfilesData = chunk.map(account => ({
                    accountId: account.accountId,
                    currentNonce: account.nonce,
                    isValidator: false, // Would need additional logic
                    isNominator: false,
                    firstSeenBlock: header.number,
                    firstSeenTimestamp: blockData.timestamp,
                    lastActivityBlock: header.number,
                    lastActivityTimestamp: blockData.timestamp
                }));
                
                // Prepare batch data for balance history
                const balanceHistoryData = chunk.map(account => ({
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
                }));
                
                // Execute batch operations in parallel for entire chunk
                await Promise.all([
                    this.database.executeBatch(
                        accountProfilesData,
                        'account_profiles',
                        ['account_id', 'display_name', 'identity_judgement', 'is_validator', 'is_nominator', 'current_nonce', 'first_seen_block', 'first_seen_timestamp', 'last_activity_block', 'last_activity_timestamp'],
                        (item) => [
                            item.accountId,
                            item.displayName || null,
                            item.identityJudgement || null,
                            item.isValidator || false,
                            item.isNominator || false,
                            this.database.prepareBigIntValue(item.currentNonce || 0),
                            this.database.prepareBigIntValue(item.firstSeenBlock),
                            item.firstSeenTimestamp || null,
                            this.database.prepareBigIntValue(item.lastActivityBlock),
                            item.lastActivityTimestamp || null
                        ],
                        chunkSize,
                        'UPSERT',
                        client
                    ),
                    this.database.executeBatch(
                        balanceHistoryData,
                        'balance_history',
                        ['account_id', 'block_hash', 'block_number', 'balance_free', 'balance_reserved', 'balance_frozen', 'nonce', 'consumers', 'providers', 'sufficients', 'free_change', 'reserved_change'],
                        (item) => [
                            item.accountId,
                            item.blockHash,
                            this.database.prepareBigIntValue(item.blockNumber),
                            this.database.prepareBigIntValue(item.balanceFree),
                            this.database.prepareBigIntValue(item.balanceReserved),
                            this.database.prepareBigIntValue(item.balanceFrozen || 0),
                            this.database.prepareBigIntValue(item.nonce),
                            this.database.prepareBigIntValue(item.consumers || 0),
                            this.database.prepareBigIntValue(item.providers || 0),
                            this.database.prepareBigIntValue(item.sufficients || 0),
                            this.database.prepareBigIntValue(item.freeChange || 0),
                            this.database.prepareBigIntValue(item.reservedChange || 0)
                        ],
                        chunkSize,
                        'INSERT',
                        client
                    )
                ]);
            }
        }

        // 6. & 7. Store transfer events and data submissions in parallel with optimized batching
        const transferEvents = this.extractTransferEvents(events, eventIds);
        const dataSubmissions = this.extractDataSubmissions(events, extrinsicIds, eventIds);
        
        const specializedOperations = [];
        
        // Transfer events processing
        if (transferEvents.length > 0) {
            const transferOperation = async () => {
                const chunkSize = 1000;
                
                for (let i = 0; i < transferEvents.length; i += chunkSize) {
                    const chunk = transferEvents.slice(i, i + chunkSize);
                    
                    // Prepare batch data for transfer events
                    const chunkData = chunk.map(transfer => ({
                        blockHash: blockData.blockHash,
                        blockNumber: header.number,
                        extrinsicId: transfer.extrinsicId,
                        eventId: transfer.eventId,
                        fromAccount: transfer.from,
                        toAccount: transfer.to,
                        amount: transfer.amount,
                        transferType: transfer.type,
                        success: true
                    }));
                    
                    await this.database.executeBatch(
                        chunkData,
                        'transfer_events',
                        ['block_hash', 'block_number', 'extrinsic_id', 'event_id', 'from_account', 'to_account', 'amount', 'transfer_type', 'success', 'fee_paid', 'tip_paid'],
                        (item) => [
                            item.blockHash,
                            this.database.prepareBigIntValue(item.blockNumber),
                            item.extrinsicId || null,
                            item.eventId || null,
                            item.fromAccount,
                            item.toAccount,
                            this.database.prepareBigIntValue(item.amount),
                            item.transferType || 'Transfer',
                            item.success !== undefined ? item.success : true,
                            this.database.prepareBigIntValue(item.feePaid || 0),
                            this.database.prepareBigIntValue(item.tipPaid || 0)
                        ],
                        chunkSize,
                        'INSERT',
                        client
                    );
                }
            };
            specializedOperations.push(transferOperation());
        }
        
        // Data submissions processing
        if (dataSubmissions.length > 0) {
            const submissionOperation = async () => {
                const chunkSize = 1000;
                
                for (let i = 0; i < dataSubmissions.length; i += chunkSize) {
                    const chunk = dataSubmissions.slice(i, i + chunkSize);
                    
                    // Prepare batch data for data submissions
                    const chunkData = chunk.map(submission => ({
                        blockHash: blockData.blockHash,
                        blockNumber: header.number,
                        extrinsicId: submission.extrinsicId,
                        appId: submission.appId,
                        submitterAccount: submission.submitter,
                        dataSize: submission.dataSize,
                        dataIndex: submission.dataIndex,
                        submissionFee: submission.fee || 0
                    }));
                    
                    await this.database.executeBatch(
                        chunkData,
                        'data_submissions',
                        ['block_hash', 'block_number', 'extrinsic_id', 'app_id', 'submitter_account', 'data_size', 'data_index', 'data_hash', 'proof_data', 'submission_fee'],
                        (item) => [
                            item.blockHash,
                            this.database.prepareBigIntValue(item.blockNumber),
                            item.extrinsicId || null,
                            this.database.prepareBigIntValue(item.appId),
                            item.submitterAccount,
                            item.dataSize,
                            item.dataIndex || null,
                            item.dataHash || null,
                            item.proofData ? this.database.safeBigIntStringify(item.proofData) : null,
                            this.database.prepareBigIntValue(item.submissionFee || 0)
                        ],
                        chunkSize,
                        'INSERT',
                        client
                    );
                }
            };
            specializedOperations.push(submissionOperation());
        }
        
        // Execute all specialized operations in parallel
        if (specializedOperations.length > 0) {
            await Promise.all(specializedOperations);
        }

        // NEW: Store additional blockchain data that was previously discarded
        const additionalDataOperations = [];

        // 1. Store storage state data
        if (storage) {
            const storageStateData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                systemData: storage.system || null,
                balancesData: storage.balances || null,
                totalIssuance: storage.balances?.totalIssuance || 0,
                daNextAppId: storage.dataAvailability?.nextAppId || 0,
                daAppKeys: storage.dataAvailability?.appKeys || null,
                daDataSubmissions: storage.dataAvailability?.dataSubmissions || null,
                sessionValidators: storage.session?.validators || null,
                sessionValidatorCount: storage.session?.validatorCount || 0,
                stakingCurrentEra: storage.staking?.currentEra || 0,
                storageExtractionNote: storage.system?.note || null
            };
            additionalDataOperations.push(this.database.insertStorageState(storageStateData, client));
        }

        // 2. Store network statistics
        if (blockData.networkStats) {
            const networkStatsData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                extrinsicsCount: blockData.networkStats.block?.extrinsicsCount || extrinsics.length,
                eventsCount: blockData.networkStats.block?.eventsCount || events.length,
                signedExtrinsicsCount: blockData.networkStats.block?.signedExtrinsics || 0,
                unsignedExtrinsicsCount: blockData.networkStats.block?.unsignedExtrinsics || 0,
                totalTips: blockData.networkStats.fees?.totalTips || 0,
                totalFees: blockData.networkStats.fees?.totalFees || 0,
                averageTip: blockData.networkStats.fees?.averageTip || 0,
                averageFee: blockData.networkStats.fees?.averageFee || 0,
                daSubmissionsCount: blockData.networkStats.dataAvailability?.dataSubmissions || 0,
                daTotalDataSize: blockData.networkStats.dataAvailability?.totalDataSize || 0,
                daUniqueAppsCount: blockData.networkStats.dataAvailability?.uniqueApps || 0,
                totalAccountsCount: blockData.networkStats.accounts?.total || 0,
                activeAccountsCount: blockData.networkStats.accounts?.active || 0
            };
            additionalDataOperations.push(this.database.insertNetworkStatistics(networkStatsData, client));
        }

        // 3. Store balances summary
        if (storage?.balances?.totalIssuance) {
            const balancesSummaryData = {
                blockHash: blockData.blockHash,
                blockNumber: header.number,
                totalIssuance: storage.balances.totalIssuance,
                totalBalanceAccounts: storage.balances.totalBalanceAccounts || 0,
                totalFreeBalance: 0, // Would need calculation
                totalReservedBalance: 0, // Would need calculation  
                totalFrozenBalance: 0, // Would need calculation
                balancePagesLoaded: storage.balances.totalPages || 0,
                balanceExtractionNote: storage.balances.note || null
            };
            additionalDataOperations.push(this.database.insertBalancesSummary(balancesSummaryData, client));
        }

        // Execute additional data storage in parallel
        if (additionalDataOperations.length > 0) {
            await Promise.all(additionalDataOperations);
        }

        // Complete blockchain data storage - nothing discarded!
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
                
                // Parse app ID properly - should be numeric
                let appId = 0;
                if (event.data && event.data[0]) {
                    try {
                        // Try to convert to number, fallback to 0 if it's an account string
                        const appIdValue = event.data[0].toString();
                        appId = /^\d+$/.test(appIdValue) ? parseInt(appIdValue) : 0;
                    } catch (e) {
                        appId = 0;
                    }
                }
                
                submissions.push({
                    eventId: eventIds[event.index],
                    extrinsicId: extrinsicIndex !== null ? extrinsicIds[extrinsicIndex] : null,
                    appId: appId,
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

        // Analytics removed - just basic data extraction and storage
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