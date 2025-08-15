// Show comprehensive recovery plan with block ranges
require('dotenv').config();
const { Pool } = require('pg');

async function showRecoveryPlan() {
    const pool = new Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_DATABASE,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        max: 5
    });
    
    try {
        console.log('🔒 ATOMIC ACCOUNT RECOVERY PLAN');
        console.log('=' .repeat(60));
        
        // Get block range analysis
        const analysis = await pool.query(`
            WITH block_stats AS (
                SELECT 
                    block_number,
                    COUNT(*) as account_count,
                    CASE 
                        WHEN COUNT(*) <= 50 THEN 'NEEDS_PROCESSING'
                        WHEN COUNT(*) > 1000 THEN 'COMPLETE'
                        ELSE 'PARTIAL'
                    END as status
                FROM balance_history 
                GROUP BY block_number
            ),
            continuous_ranges AS (
                SELECT 
                    status,
                    MIN(block_number) as start_block,
                    MAX(block_number) as end_block,
                    COUNT(*) as block_count,
                    AVG(account_count) as avg_accounts
                FROM block_stats
                WHERE status IN ('NEEDS_PROCESSING', 'COMPLETE')
                GROUP BY status
            ),
            range_groups AS (
                SELECT 
                    block_number,
                    status,
                    block_number - ROW_NUMBER() OVER (PARTITION BY status ORDER BY block_number) as group_id
                FROM block_stats
                WHERE status = 'NEEDS_PROCESSING'
            ),
            processing_ranges AS (
                SELECT 
                    MIN(block_number) as start_block,
                    MAX(block_number) as end_block,
                    COUNT(*) as block_count
                FROM range_groups
                GROUP BY group_id
                HAVING COUNT(*) > 100  -- Only significant ranges
            )
            SELECT 
                start_block,
                end_block,
                block_count,
                ROUND(block_count * 100000.0) as estimated_accounts  -- Assume 100k accounts per block
            FROM processing_ranges
            ORDER BY start_block
        `);
        
        // Get summary statistics
        const summary = await pool.query(`
            WITH block_stats AS (
                SELECT 
                    block_number,
                    COUNT(*) as account_count,
                    CASE 
                        WHEN COUNT(*) <= 50 THEN 'NEEDS_PROCESSING'
                        WHEN COUNT(*) > 1000 THEN 'COMPLETE'
                        ELSE 'PARTIAL'
                    END as status
                FROM balance_history 
                GROUP BY block_number
            )
            SELECT 
                status,
                COUNT(*) as block_count,
                SUM(CASE WHEN status = 'NEEDS_PROCESSING' THEN 1 ELSE 0 END) as total_needs_processing,
                MIN(block_number) as first_block,
                MAX(block_number) as last_block
            FROM block_stats
            GROUP BY status
        `);
        
        console.log('\\n📊 RECOVERY RANGES (Major Continuous Ranges):');
        console.log('Start Block | End Block   | Block Count | Est. Accounts | Command');
        console.log('------------|-------------|-------------|---------------|--------');
        
        let totalProcessingBlocks = 0;
        let totalEstimatedAccounts = 0;
        
        for (const range of analysis.rows) {
            const startBlock = range.start_block;
            const endBlock = range.end_block;
            const blockCount = parseInt(range.block_count);
            const estimatedAccounts = parseInt(range.estimated_accounts);
            
            totalProcessingBlocks += blockCount;
            totalEstimatedAccounts += estimatedAccounts;
            
            const command = `node atomic-account-recovery.js ${startBlock} ${endBlock} 100`;
            
            console.log(`${startBlock.toString().padStart(11)} | ${endBlock.toString().padStart(11)} | ${blockCount.toLocaleString().padStart(11)} | ${estimatedAccounts.toLocaleString().padStart(13)} | ${command}`);
        }
        
        console.log('\\n📈 SUMMARY:');
        for (const stat of summary.rows) {
            const emoji = {
                'NEEDS_PROCESSING': '🔴',
                'COMPLETE': '✅',
                'PARTIAL': '🟡'
            }[stat.status] || '❓';
            
            console.log(`${emoji} ${stat.status.padEnd(18)} | ${parseInt(stat.block_count).toLocaleString().padStart(8)} blocks | Range: ${stat.first_block}-${stat.last_block}`);
        }
        
        console.log('\\n🎯 RECOMMENDED EXECUTION PLAN:');
        console.log('1. Start with highest-priority range (most blocks)');
        console.log('2. Use batch size 100-500 depending on system resources');
        console.log('3. Monitor progress with atomic-recovery-progress.json');
        console.log('4. Resume automatically if interrupted');
        
        console.log('\\n⏰ ESTIMATED TIME:');
        console.log(`- Total blocks needing processing: ${totalProcessingBlocks.toLocaleString()}`);
        console.log(`- Estimated accounts to recover: ${totalEstimatedAccounts.toLocaleString()}`);
        console.log(`- Estimated time: ${Math.round(totalProcessingBlocks / 500)} hours (at 500 blocks/hour)`);
        console.log(`- Storage growth: +${Math.round(totalEstimatedAccounts / 1000000)} GB`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

showRecoveryPlan();