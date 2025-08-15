// Atomic Account Recovery - Prevents partial processing states
require('dotenv').config();
const { initialize } = require('avail-js-sdk');
const { ExplorerDatabase } = require('./explorer-database');
const { BackupManager } = require('./backup-manager');
const fs = require('fs').promises;

class AtomicAccountRecovery {
    constructor() {
        this.api = null;
        this.database = new ExplorerDatabase();
        this.backupManager = new BackupManager();
        this.progressFile = 'atomic-recovery-progress.json';
        this.stats = {
            totalBlocks: 0,
            blocksCompleted: 0,
            totalAccountsRestored: 0,
            startTime: 0,
            lastBlockCompleted: 0,
            batchesCompleted: 0,
            skippedBlocks: 0
        };
    }

    async connect() {
        console.log('🔗 Connecting to Avail network...');
        this.api = await initialize(process.env.AVAIL_RPC_URL);
        await this.api.isReady;
        console.log('✅ Connected to Avail network');
    }

    // Check if block already has complete account data
    async isBlockComplete(blockNumber) {
        const result = await this.database.query(`
            SELECT COUNT(*) as count FROM balance_history WHERE block_number = $1
        `, [blockNumber]);
        
        const currentCount = parseInt(result.rows[0].count);
        const isComplete = currentCount > 1000; // Threshold for complete blocks
        
        return { isComplete, currentCount };
    }

    // Extract all accounts from blockchain (outside transaction)
    async extractAllAccountsFromBlock(blockHash) {
        console.log(`    🔍 Extracting ALL accounts from blockchain...`);
        
        let allAccounts = [];
        let startKey = null;
        let page = 0;
        const PROGRESS_INTERVAL = 10000;
        
        while (true) {
            page++;
            
            const pageAccounts = await this.api.query.system.account.entriesPaged({
                args: [],
                pageSize: 1000,
                startKey: startKey
            }, blockHash);
            
            if (pageAccounts.length === 0) {
                console.log(`    ✅ Account extraction complete: ${allAccounts.length} accounts in ${page} pages`);
                break;
            }
            
            allAccounts.push(...pageAccounts);
            
            // Progress reporting every 10k accounts
            if (allAccounts.length % PROGRESS_INTERVAL === 0) {
                console.log(`    📈 Extraction progress: ${allAccounts.length} accounts...`);
            }
            
            if (pageAccounts.length < 1000) {
                console.log(`    ✅ Last page reached: ${allAccounts.length} total accounts`);
                break;
            }
            
            startKey = pageAccounts[pageAccounts.length - 1][0];
        }
        
        return allAccounts;
    }

    // Verify block processing completeness
    async verifyBlockIntegrity(blockNumber, expectedCount, client = null) {
        const result = await this.database.query(`
            SELECT COUNT(*) as count FROM balance_history WHERE block_number = $1
        `, [blockNumber], client);
        
        const actualCount = parseInt(result.rows[0].count);
        
        if (actualCount !== expectedCount) {
            throw new Error(`Block ${blockNumber} integrity check failed: Expected ${expectedCount} accounts, found ${actualCount}`);
        }
        
        console.log(`    ✅ Integrity verified: ${actualCount} accounts stored correctly`);
        return actualCount;
    }

    // ATOMIC block processing - Extract and store with full atomicity
    async processBlockAtomically(blockNumber, retries = 3) {
        console.log(`\n🔒 ATOMIC processing block ${blockNumber}...`);
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
                
                // PRE-PROCESSING: Check if block already complete
                const { isComplete, currentCount } = await this.isBlockComplete(blockNumber);
                if (isComplete) {
                    console.log(`  ⏭️ Block ${blockNumber} already COMPLETE (${currentCount} accounts) - skipping`);
                    this.stats.skippedBlocks++;
                    return { skipped: true, accountCount: currentCount };
                }
                
                console.log(`  📊 Current: ${currentCount} accounts (INCOMPLETE) - processing full set...`);
                
                // STEP 1: Extract ALL accounts from blockchain (OUTSIDE transaction)
                console.log(`  🔍 Step 1: Extracting accounts from blockchain...`);
                const allExtractedAccounts = await this.extractAllAccountsFromBlock(blockHash);
                
                if (allExtractedAccounts.length === 0) {
                    console.log(`  ⚠️ No accounts found for block ${blockNumber} - skipping`);
                    this.stats.skippedBlocks++;
                    return { skipped: true, accountCount: 0 };
                }
                
                console.log(`  ✅ Step 1 complete: ${allExtractedAccounts.length} accounts extracted`);
                
                // STEP 2: ATOMIC database transaction - all or nothing
                console.log(`  🔒 Step 2: ATOMIC database transaction...`);
                let finalAccountCount = 0;
                
                await this.database.withTransaction(async (client) => {
                    console.log(`    🔒 Starting ATOMIC transaction for block ${blockNumber}...`);
                    
                    // Delete ALL existing records for this block
                    const deleteResult = await this.database.query(`
                        DELETE FROM balance_history WHERE block_number = $1
                    `, [blockNumber], client);
                    
                    console.log(`    🗑️ Cleared ${deleteResult.rowCount} existing records`);
                    
                    // Prepare ALL account and balance data
                    console.log(`    📦 Preparing ${allExtractedAccounts.length} account records...`);
                    const accountProfiles = [];
                    const balanceHistory = [];
                    
                    for (const [accountId, accountInfo] of allExtractedAccounts) {
                        const accountIdStr = accountId.toString();
                        
                        // Account profile
                        accountProfiles.push({
                            accountId: accountIdStr,
                            displayName: null,
                            identityJudgement: null,
                            isValidator: false,
                            isNominator: false,
                            currentNonce: this.safeBigIntValue(accountInfo.nonce),
                            firstSeenBlock: BigInt(blockNumber),
                            firstSeenTimestamp: null,
                            lastActivityBlock: BigInt(blockNumber),
                            lastActivityTimestamp: null
                        });
                        
                        // Balance history
                        balanceHistory.push({
                            accountId: accountIdStr,
                            blockHash: blockHash.toString(),
                            blockNumber: BigInt(blockNumber),
                            balanceFree: this.safeBigIntValue(accountInfo.data.free),
                            balanceReserved: this.safeBigIntValue(accountInfo.data.reserved),
                            balanceFrozen: accountInfo.data.frozen ? this.safeBigIntValue(accountInfo.data.frozen) : BigInt(0),
                            nonce: this.safeBigIntValue(accountInfo.nonce),
                            consumers: this.safeBigIntValue(accountInfo.consumers),
                            providers: this.safeBigIntValue(accountInfo.providers),
                            sufficients: this.safeBigIntValue(accountInfo.sufficients),
                            freeChange: BigInt(0),
                            reservedChange: BigInt(0)
                        });
                    }
                    
                    // Store ALL account profiles (UPSERT)
                    console.log(`    💾 Storing ${accountProfiles.length} account profiles (UPSERT)...`);
                    await this.database.upsertAccountProfilesBatch(accountProfiles, client);
                    
                    // Store ALL balance history records
                    console.log(`    💾 Storing ${balanceHistory.length} balance history records...`);
                    await this.database.insertBalanceHistoryBatch(balanceHistory, client);
                    
                    // POST-PROCESSING VERIFICATION: Ensure complete processing
                    console.log(`    🔍 Verifying transaction integrity...`);
                    finalAccountCount = await this.verifyBlockIntegrity(blockNumber, allExtractedAccounts.length, client);
                    
                    console.log(`    ✅ ATOMIC transaction verified and complete`);
                });
                
                // SUCCESS: Update statistics (only after complete success)
                console.log(`  🎉 Block ${blockNumber} ATOMICALLY processed: ${finalAccountCount} accounts`);
                
                this.stats.totalAccountsRestored += finalAccountCount;
                this.stats.blocksCompleted++;
                this.stats.lastBlockCompleted = blockNumber;
                
                return { accountCount: finalAccountCount };
                
            } catch (error) {
                console.error(`❌ ATOMIC processing attempt ${attempt}/${retries} failed for block ${blockNumber}:`);
                console.error(`   Error: ${error.message}`);
                
                if (attempt === retries) {
                    console.error(`💥 Block ${blockNumber} failed after ${retries} attempts - giving up`);
                    throw error;
                }
                
                // Exponential backoff
                const delay = 5000 * Math.pow(2, attempt - 1);
                console.log(`⏳ Waiting ${delay/1000}s before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Load progress from file
    async loadProgress() {
        try {
            const data = await fs.readFile(this.progressFile, 'utf8');
            const progress = JSON.parse(data);
            this.stats = { ...this.stats, ...progress };
            console.log(`📂 Progress loaded: Last completed block ${this.stats.lastBlockCompleted}`);
            return progress;
        } catch (error) {
            console.log('📂 No existing progress found - starting fresh');
            return null;
        }
    }

    // Save progress to file (only after successful block completion)
    async saveProgress() {
        try {
            const progressData = {
                ...this.stats,
                lastSaved: new Date().toISOString(),
                totalRunTime: Date.now() - this.stats.startTime
            };
            
            await fs.writeFile(this.progressFile, JSON.stringify(progressData, null, 2));
            console.log(`💾 Progress saved: Block ${this.stats.lastBlockCompleted} (${this.stats.blocksCompleted} completed)`);
        } catch (error) {
            console.error('⚠️ Failed to save progress:', error.message);
        }
    }

    // Process block range with atomic guarantees
    async processBlockRange(startBlock, endBlock, batchSize = 100) {
        console.log(`\n🔒 Starting ATOMIC account recovery for blocks ${startBlock}-${endBlock}`);
        console.log(`📊 Processing in batches of ${batchSize} blocks with ATOMIC guarantees`);
        
        this.stats.totalBlocks = endBlock - startBlock + 1;
        this.stats.startTime = Date.now();
        
        // Load existing progress
        await this.loadProgress();
        
        // Determine where to start (resume from last completed + 1)
        const actualStartBlock = Math.max(startBlock, this.stats.lastBlockCompleted + 1);
        
        if (actualStartBlock > startBlock) {
            console.log(`📂 Resuming from block ${actualStartBlock} (${actualStartBlock - startBlock} blocks already completed)`);
        }
        
        // Process in batches with atomic guarantees
        for (let batchStart = actualStartBlock; batchStart <= endBlock; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize - 1, endBlock);
            
            console.log(`\n📦 ATOMIC batch processing: blocks ${batchStart}-${batchEnd}`);
            
            // Create backup for this batch
            const backupInfo = await this.backupManager.createBackupTables(
                batchStart, 
                batchEnd, 
                `_atomic_batch_${this.stats.batchesCompleted + 1}`
            );
            
            try {
                // Process each block atomically
                for (let blockNum = batchStart; blockNum <= batchEnd; blockNum++) {
                    const result = await this.processBlockAtomically(blockNum);
                    
                    // Progress reporting
                    if (blockNum % 10 === 0 || !result.skipped) {
                        const progress = ((blockNum - startBlock + 1) / this.stats.totalBlocks * 100).toFixed(2);
                        const elapsed = (Date.now() - this.stats.startTime) / 1000;
                        const rate = this.stats.blocksCompleted / elapsed;
                        const eta = (endBlock - blockNum) / rate / 3600; // hours
                        
                        console.log(`\n📊 ATOMIC Progress Report:`);
                        console.log(`  📈 Overall: ${progress}% (${blockNum}/${endBlock})`);
                        console.log(`  ✅ Completed: ${this.stats.blocksCompleted} blocks`);
                        console.log(`  ⏭️ Skipped: ${this.stats.skippedBlocks} blocks (already complete)`);
                        console.log(`  🔢 Accounts: ${this.stats.totalAccountsRestored.toLocaleString()} restored`);
                        console.log(`  ⚡ Rate: ${rate.toFixed(2)} blocks/sec`);
                        console.log(`  ⏰ ETA: ${eta.toFixed(1)} hours`);
                    }
                    
                    // Save progress every 10 blocks
                    if (blockNum % 10 === 0) {
                        await this.saveProgress();
                    }
                }
                
                this.stats.batchesCompleted++;
                await this.saveProgress();
                
                console.log(`✅ ATOMIC batch ${this.stats.batchesCompleted} completed successfully`);
                
                // Clean up successful batch backup
                await this.backupManager.cleanupBackups(backupInfo);
                
            } catch (error) {
                console.error(`❌ ATOMIC batch failed: ${error.message}`);
                
                // Restore from backup
                console.log(`🔄 Restoring ATOMIC batch from backup...`);
                await this.backupManager.restoreFromBackup(backupInfo);
                
                throw error;
            }
        }
        
        // Final statistics
        const totalTime = (Date.now() - this.stats.startTime) / 1000;
        console.log(`\n🎉 ATOMIC account recovery completed!`);
        console.log(`📊 Final ATOMIC Statistics:`);
        console.log(`  - Total blocks processed: ${this.stats.blocksCompleted}`);
        console.log(`  - Total blocks skipped: ${this.stats.skippedBlocks} (already complete)`);
        console.log(`  - Total accounts restored: ${this.stats.totalAccountsRestored.toLocaleString()}`);
        console.log(`  - Total time: ${(totalTime / 3600).toFixed(2)} hours`);
        console.log(`  - Processing rate: ${(this.stats.blocksCompleted / totalTime).toFixed(2)} blocks/second`);
        console.log(`  - Average accounts per block: ${Math.round(this.stats.totalAccountsRestored / Math.max(this.stats.blocksCompleted, 1)).toLocaleString()}`);
        
        return this.stats;
    }

    safeBigIntValue(value) {
        try {
            if (typeof value === 'bigint') return value;
            if (value && typeof value.toBigInt === 'function') return value.toBigInt();
            if (value && typeof value.toString === 'function') {
                const str = value.toString();
                if (/^\\d+$/.test(str)) return BigInt(str);
            }
            return BigInt(0);
        } catch (error) {
            return BigInt(0);
        }
    }

    async disconnect() {
        if (this.api) await this.api.disconnect();
        await this.database.close();
        await this.backupManager.close();
        console.log('🔌 ATOMIC recovery disconnected');
    }
}

// Command line interface
async function main() {
    if (process.argv.length < 4) {
        console.log('Usage: node atomic-account-recovery.js <start_block> <end_block> [batch_size]');
        console.log('');
        console.log('Examples:');
        console.log('  node atomic-account-recovery.js 1 93711 100        # Full recovery');
        console.log('  node atomic-account-recovery.js 80000 85000 50     # Partial recovery');
        console.log('  node atomic-account-recovery.js 50000 50010 5      # Small test');
        console.log('');
        console.log('Features:');
        console.log('  - ATOMIC processing (no partial states)');
        console.log('  - Automatic skip of already complete blocks');
        console.log('  - Resumable from interruptions');
        console.log('  - Complete backup/restore safety');
        process.exit(1);
    }
    
    const startBlock = parseInt(process.argv[2]);
    const endBlock = parseInt(process.argv[3]);
    const batchSize = parseInt(process.argv[4]) || 100;
    
    if (isNaN(startBlock) || isNaN(endBlock) || startBlock > endBlock) {
        console.error('❌ Invalid block range');
        process.exit(1);
    }
    
    console.log(`🔒 ATOMIC Account Recovery`);
    console.log(`📊 Target: blocks ${startBlock}-${endBlock} (${endBlock - startBlock + 1} blocks)`);
    console.log(`📦 Batch size: ${batchSize} blocks`);
    console.log(`🔒 ATOMIC guarantees: No partial processing states`);
    console.log(`⏰ Estimated time: ${((endBlock - startBlock + 1) / batchSize * 0.5).toFixed(1)} hours`);
    
    const recovery = new AtomicAccountRecovery();
    
    try {
        await recovery.connect();
        await recovery.processBlockRange(startBlock, endBlock, batchSize);
        console.log('\\n✅ ATOMIC recovery completed successfully!');
        
    } catch (error) {
        console.error('❌ ATOMIC recovery failed:', error.message);
        console.log('💡 Progress saved - resume with same command');
        process.exit(1);
    } finally {
        await recovery.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = { AtomicAccountRecovery };