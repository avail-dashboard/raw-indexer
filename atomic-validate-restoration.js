// Atomic Restoration Validator - Works with atomic processing
require('dotenv').config();
const { Pool } = require('pg');

class AtomicRestorationValidator {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            max: 5,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 30000
        });
    }

    async query(text, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    // Check atomic processing completeness for block range
    async validateAtomicCompleteness(startBlock, endBlock) {
        console.log(`\\n🔒 Validating ATOMIC completeness for blocks ${startBlock}-${endBlock}...`);
        
        try {
            const result = await this.query(`
                WITH block_stats AS (
                    SELECT 
                        block_number,
                        COUNT(*) as account_count,
                        CASE 
                            WHEN COUNT(*) <= 50 THEN 'INCOMPLETE' 
                            WHEN COUNT(*) BETWEEN 51 AND 1000 THEN 'PARTIAL'
                            WHEN COUNT(*) > 1000 THEN 'COMPLETE'
                        END as processing_status
                    FROM balance_history 
                    WHERE block_number BETWEEN $1 AND $2
                    GROUP BY block_number
                ),
                all_expected_blocks AS (
                    SELECT generate_series($1, $2) as block_number
                ),
                block_analysis AS (
                    SELECT 
                        aeb.block_number,
                        COALESCE(bs.account_count, 0) as account_count,
                        COALESCE(bs.processing_status, 'MISSING') as processing_status
                    FROM all_expected_blocks aeb
                    LEFT JOIN block_stats bs ON aeb.block_number = bs.block_number
                )
                SELECT 
                    processing_status,
                    COUNT(*) as block_count,
                    AVG(account_count) as avg_accounts,
                    MIN(account_count) as min_accounts,
                    MAX(account_count) as max_accounts,
                    array_agg(block_number ORDER BY block_number) as sample_blocks
                FROM block_analysis
                GROUP BY processing_status
                ORDER BY 
                    CASE processing_status
                        WHEN 'MISSING' THEN 1
                        WHEN 'INCOMPLETE' THEN 2  
                        WHEN 'PARTIAL' THEN 3
                        WHEN 'COMPLETE' THEN 4
                    END
            `, [startBlock, endBlock]);
            
            console.log('\\n📊 ATOMIC Processing Status:');
            console.log('=' .repeat(80));
            
            let totalBlocks = 0;
            let completeBlocks = 0;
            let incompleteBlocks = 0;
            
            for (const row of result.rows) {
                const status = row.processing_status;
                const count = parseInt(row.block_count);
                const avgAccounts = parseFloat(row.avg_accounts || 0);
                const minAccounts = parseInt(row.min_accounts || 0);
                const maxAccounts = parseInt(row.max_accounts || 0);
                const sampleBlocks = row.sample_blocks;
                
                totalBlocks += count;
                if (status === 'COMPLETE') completeBlocks += count;
                if (status === 'INCOMPLETE' || status === 'PARTIAL' || status === 'MISSING') incompleteBlocks += count;
                
                const emoji = {
                    'MISSING': '❌',
                    'INCOMPLETE': '🔴', 
                    'PARTIAL': '🟡',
                    'COMPLETE': '✅'
                }[status] || '❓';
                
                console.log(`${emoji} ${status.padEnd(12)} | ${count.toString().padStart(6)} blocks | Avg: ${avgAccounts.toFixed(0).padStart(8)} accounts | Range: ${minAccounts}-${maxAccounts}`);
                
                if (sampleBlocks && sampleBlocks.length > 0) {
                    console.log(`    Sample blocks: ${sampleBlocks.join(', ')}${count > 5 ? '...' : ''}`);
                }
            }
            
            console.log('=' .repeat(80));
            console.log(`📊 Summary: ${completeBlocks}/${totalBlocks} blocks COMPLETE (${(completeBlocks/totalBlocks*100).toFixed(1)}%)`);
            
            const atomicCompliance = incompleteBlocks === 0;
            if (atomicCompliance) {
                console.log('✅ ATOMIC COMPLIANCE: All blocks are either COMPLETE or not yet processed');
                console.log('🔒 No partial processing states detected');
            } else {
                console.log('❌ ATOMIC VIOLATION: Found blocks in partial/incomplete states');
                console.log('⚠️ These blocks need atomic reprocessing');
            }
            
            return {
                totalBlocks,
                completeBlocks, 
                incompleteBlocks,
                atomicCompliance,
                details: result.rows
            };
            
        } catch (error) {
            console.error('❌ ATOMIC validation failed:', error.message);
            throw error;
        }
    }

    // Validate that no block is in partial processing state
    async detectPartialProcessingStates(startBlock, endBlock) {
        console.log(`\\n🔍 Detecting partial processing states...`);
        
        try {
            const result = await this.query(`
                WITH suspicious_blocks AS (
                    SELECT 
                        block_number,
                        COUNT(*) as account_count
                    FROM balance_history 
                    WHERE block_number BETWEEN $1 AND $2
                    GROUP BY block_number
                    HAVING COUNT(*) BETWEEN 51 AND 1000  -- Suspicious range
                )
                SELECT 
                    block_number,
                    account_count,
                    'PARTIAL_STATE' as issue_type,
                    'Block has suspicious account count - may be partially processed' as description
                FROM suspicious_blocks
                ORDER BY block_number
                LIMIT 20
            `, [startBlock, endBlock]);
            
            if (result.rows.length === 0) {
                console.log('✅ No partial processing states detected');
                console.log('🔒 All blocks are either fully complete or clearly incomplete');
                return { hasPartialStates: false, partialBlocks: [] };
            } else {
                console.log(`❌ Found ${result.rows.length} blocks in suspicious partial states:`);
                for (const row of result.rows) {
                    console.log(`   Block ${row.block_number}: ${row.account_count} accounts (${row.description})`);
                }
                return { hasPartialStates: true, partialBlocks: result.rows };
            }
            
        } catch (error) {
            console.error('❌ Partial state detection failed:', error.message);
            throw error;
        }
    }

    // Compare before/after atomic processing
    async validateAtomicProcessing(startBlock, endBlock, backupTableName = null) {
        console.log(`\\n📊 Validating ATOMIC processing results...`);
        
        try {
            // Get current state
            const currentStats = await this.query(`
                SELECT 
                    block_number,
                    COUNT(*) as current_count,
                    COUNT(DISTINCT account_id) as unique_accounts,
                    AVG(CAST(balance_free AS NUMERIC)) as avg_balance
                FROM balance_history 
                WHERE block_number BETWEEN $1 AND $2
                GROUP BY block_number
                ORDER BY block_number
            `, [startBlock, endBlock]);
            
            // Get backup comparison if available
            let backupStats = [];
            if (backupTableName) {
                backupStats = await this.query(`
                    SELECT 
                        block_number,
                        COUNT(*) as backup_count,
                        COUNT(DISTINCT account_id) as backup_unique_accounts
                    FROM ${backupTableName}
                    WHERE block_number BETWEEN $1 AND $2
                    GROUP BY block_number
                    ORDER BY block_number
                `, [startBlock, endBlock]);
            }
            
            const backupMap = new Map(backupStats.map(row => [row.block_number, row]));
            
            console.log('\\n📊 ATOMIC Processing Results:');
            console.log('=' .repeat(100));
            console.log('Block     | Current  | Previous | Gained   | Status      | Avg Balance');
            console.log('=' .repeat(100));
            
            let totalGained = 0;
            let processedBlocks = 0;
            let atomicBlocks = 0;
            
            for (const current of currentStats) {
                const blockNum = current.block_number;
                const currentCount = parseInt(current.current_count);
                const backup = backupMap.get(blockNum);
                const backupCount = backup ? parseInt(backup.backup_count) : 0;
                const gained = currentCount - backupCount;
                const avgBalance = parseFloat(current.avg_balance || 0);
                
                let status = 'NEW';
                if (backup) {
                    if (gained > 1000) status = '✅ ATOMIC';
                    else if (gained > 0) status = '🟡 SMALL';
                    else if (gained === 0) status = '⚪ UNCHANGED';
                    else status = '❌ LOSS';
                }
                
                if (gained > 1000) atomicBlocks++;
                if (gained > 0) {
                    processedBlocks++;
                    totalGained += gained;
                }
                
                console.log(`${blockNum.toString().padStart(9)} | ${currentCount.toString().padStart(8)} | ${backupCount.toString().padStart(8)} | ${gained.toString().padStart(8)} | ${status.padEnd(11)} | ${avgBalance.toLocaleString()}`);
            }
            
            console.log('=' .repeat(100));
            console.log(`📊 ATOMIC Summary:`);
            console.log(`  - Blocks processed: ${processedBlocks}`);
            console.log(`  - ATOMIC compliant: ${atomicBlocks} (blocks with 1000+ account gains)`);
            console.log(`  - Total accounts gained: ${totalGained.toLocaleString()}`);
            console.log(`  - Average gain per processed block: ${Math.round(totalGained / Math.max(processedBlocks, 1)).toLocaleString()}`);
            
            return {
                processedBlocks,
                atomicBlocks,
                totalGained,
                success: atomicBlocks > 0 && totalGained > 0
            };
            
        } catch (error) {
            console.error('❌ ATOMIC processing validation failed:', error.message);
            throw error;
        }
    }

    // Comprehensive ATOMIC validation
    async comprehensiveAtomicValidation(startBlock, endBlock, backupTableName = null) {
        console.log(`\\n🔒 COMPREHENSIVE ATOMIC VALIDATION for blocks ${startBlock}-${endBlock}`);
        console.log('=' .repeat(80));
        
        try {
            const results = {
                atomicCompleteness: await this.validateAtomicCompleteness(startBlock, endBlock),
                partialStateCheck: await this.detectPartialProcessingStates(startBlock, endBlock),
                processingValidation: await this.validateAtomicProcessing(startBlock, endBlock, backupTableName)
            };
            
            console.log('\\n🏁 COMPREHENSIVE ATOMIC VALIDATION RESULTS');
            console.log('=' .repeat(80));
            
            const allChecksPass = 
                results.atomicCompleteness.atomicCompliance &&
                !results.partialStateCheck.hasPartialStates &&
                results.processingValidation.success;
            
            if (allChecksPass) {
                console.log('✅ ALL ATOMIC VALIDATIONS PASSED');
                console.log('🔒 No partial processing states detected');
                console.log('📊 Processing results verified');
                console.log('🎉 ATOMIC recovery is working correctly!');
            } else {
                console.log('❌ SOME ATOMIC VALIDATIONS FAILED');
                
                if (!results.atomicCompleteness.atomicCompliance) {
                    console.log('⚠️ Found blocks in partial states');
                }
                if (results.partialStateCheck.hasPartialStates) {
                    console.log('⚠️ Detected suspicious partial processing');
                }
                if (!results.processingValidation.success) {
                    console.log('⚠️ Processing validation failed');
                }
                
                console.log('🔧 These blocks need atomic reprocessing');
            }
            
            return {
                success: allChecksPass,
                results: results
            };
            
        } catch (error) {
            console.error('❌ Comprehensive ATOMIC validation failed:', error.message);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
        console.log('🔌 ATOMIC validator disconnected');
    }
}

// Command line interface
async function main() {
    if (process.argv.length < 4) {
        console.log('Usage: node atomic-validate-restoration.js <start_block> <end_block> [backup_table_name]');
        console.log('');
        console.log('Examples:');
        console.log('  node atomic-validate-restoration.js 50000 50010');
        console.log('  node atomic-validate-restoration.js 1 1000 balance_history_backup_20250806t123000');
        console.log('');
        console.log('Features:');
        console.log('  - Validates ATOMIC processing compliance');
        console.log('  - Detects partial processing states');
        console.log('  - Compares before/after results');
        process.exit(1);
    }
    
    const startBlock = parseInt(process.argv[2]);
    const endBlock = parseInt(process.argv[3]);
    const backupTableName = process.argv[4] || null;
    
    if (isNaN(startBlock) || isNaN(endBlock) || startBlock > endBlock) {
        console.error('❌ Invalid block range');
        process.exit(1);
    }
    
    const validator = new AtomicRestorationValidator();
    
    try {
        const result = await validator.comprehensiveAtomicValidation(startBlock, endBlock, backupTableName);
        
        if (result.success) {
            console.log('\\n✅ ATOMIC validation completed successfully');
            process.exit(0);
        } else {
            console.log('\\n❌ ATOMIC validation detected issues');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ ATOMIC validation error:', error.message);
        process.exit(1);
    } finally {
        await validator.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { AtomicRestorationValidator };