// Simple check for atomic processing status
require('dotenv').config();
const { Pool } = require('pg');

async function checkAtomicStatus(startBlock, endBlock) {
    const pool = new Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_DATABASE,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        max: 5
    });
    
    try {
        console.log(`🔒 Checking ATOMIC processing status for blocks ${startBlock}-${endBlock}`);
        
        const result = await pool.query(`
            SELECT 
                block_number,
                COUNT(*) as account_count,
                CASE 
                    WHEN COUNT(*) <= 50 THEN 'INCOMPLETE'
                    WHEN COUNT(*) BETWEEN 51 AND 1000 THEN 'PARTIAL'
                    WHEN COUNT(*) > 1000 THEN 'COMPLETE'
                END as status
            FROM balance_history 
            WHERE block_number BETWEEN $1 AND $2
            GROUP BY block_number
            ORDER BY block_number
        `, [startBlock, endBlock]);
        
        console.log('\\n📊 Block Status Report:');
        console.log('Block     | Accounts | Status');
        console.log('----------|----------|----------');
        
        let completeBlocks = 0;
        let incompleteBlocks = 0;
        let partialBlocks = 0;
        
        for (const row of result.rows) {
            const emoji = {
                'INCOMPLETE': '🔴',
                'PARTIAL': '🟡', 
                'COMPLETE': '✅'
            }[row.status];
            
            console.log(`${row.block_number.toString().padStart(9)} | ${row.account_count.toString().padStart(8)} | ${emoji} ${row.status}`);
            
            if (row.status === 'COMPLETE') completeBlocks++;
            else if (row.status === 'PARTIAL') partialBlocks++;
            else incompleteBlocks++;
        }
        
        console.log('\\n📈 Summary:');
        console.log(`✅ Complete blocks: ${completeBlocks}`);
        console.log(`🔴 Incomplete blocks: ${incompleteBlocks}`);
        console.log(`🟡 Partial blocks: ${partialBlocks}`);
        
        if (partialBlocks === 0) {
            console.log('\\n🔒 ✅ ATOMIC COMPLIANCE: No partial processing states detected');
            console.log('All blocks are either complete or cleanly incomplete');
        } else {
            console.log('\\n❌ ATOMIC VIOLATION: Found partial processing states');
            console.log('These blocks need to be reprocessed atomically');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Get command line arguments
const startBlock = parseInt(process.argv[2]);
const endBlock = parseInt(process.argv[3]);

if (isNaN(startBlock) || isNaN(endBlock)) {
    console.log('Usage: node check-atomic-status.js <start_block> <end_block>');
    console.log('Example: node check-atomic-status.js 50000 50001');
    process.exit(1);
}

checkAtomicStatus(startBlock, endBlock);