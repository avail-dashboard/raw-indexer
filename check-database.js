const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'liquidGlass',
  database: 'Sakshi',
  host: 'localhost',
  port: 5432
});

async function checkData() {
  try {
    const queries = [
      'SELECT COUNT(*) as blocks FROM blocks',
      'SELECT COUNT(*) as extrinsics FROM extrinsics',
      'SELECT COUNT(*) as events FROM events',
      'SELECT COUNT(*) as transfers FROM transfer_entities',
      'SELECT COUNT(*) as account_entities FROM account_entities',
      'SELECT COUNT(*) as account_updates FROM accoun_to_update_values',
      'SELECT COUNT(*) as header_extensions FROM header_extensions',
      'SELECT COUNT(*) as app_lookups FROM app_lookups',
      'SELECT COUNT(*) as commitments FROM commitments',
      'SELECT COUNT(*) as data_submissions FROM data_submissions',
      'SELECT COUNT(*) as logs FROM logs',
      'SELECT COUNT(*) as sessions FROM sessions',
      'SELECT COUNT(*) as spec_versions FROM spec_versions',
      'SELECT MIN(number) as min_block, MAX(number) as max_block FROM blocks'
    ];
    
    console.log('📊 Current Database Status:');
    
    for (const query of queries) {
      const result = await pool.query(query);
      const data = result.rows[0];
      if (data.blocks !== undefined) console.log('  • Blocks:', data.blocks);
      if (data.extrinsics !== undefined) console.log('  • Extrinsics:', data.extrinsics);
      if (data.events !== undefined) console.log('  • Events:', data.events);
      if (data.transfers !== undefined) console.log('  • Transfers:', data.transfers);
      if (data.account_entities !== undefined) console.log('  • Account Entities:', data.account_entities);
      if (data.account_updates !== undefined) console.log('  • Account Updates:', data.account_updates);
      if (data.header_extensions !== undefined) console.log('  • Header Extensions:', data.header_extensions);
      if (data.app_lookups !== undefined) console.log('  • App Lookups:', data.app_lookups);
      if (data.commitments !== undefined) console.log('  • Commitments:', data.commitments);
      if (data.data_submissions !== undefined) console.log('  • Data Submissions:', data.data_submissions);
      if (data.logs !== undefined) console.log('  • Logs:', data.logs);
      if (data.sessions !== undefined) console.log('  • Sessions:', data.sessions);
      if (data.spec_versions !== undefined) console.log('  • Spec Versions:', data.spec_versions);
      if (data.min_block !== undefined) console.log('  • Block Range:', data.min_block, '-', data.max_block);
    }
    
    // Show sample data from app_lookups table
    console.log('\n📋 Sample App Lookups (Avail DA applications):');
    const appSample = await pool.query('SELECT app_id, size, index_value FROM app_lookups LIMIT 5');
    appSample.rows.forEach((row, i) => {
      console.log('  ', i+1, '• App ID:', row.app_id, '| Size:', row.size, '| Index:', row.index_value);
    });
    
    // Show sample data from commitments table
    console.log('\n🔒 Sample Commitments (DA commitments):');
    const commitSample = await pool.query('SELECT LEFT(commitment, 50) as commitment_preview, length FROM commitments LIMIT 3');
    commitSample.rows.forEach((row, i) => {
      console.log('  ', i+1, '• Commitment:', row.commitment_preview + '...', '| Length:', row.length);
    });
    
    // Show actual blocks indexed
    console.log('\n🧱 Indexed Blocks:');
    const blocks = await pool.query('SELECT number, hash FROM blocks ORDER BY number');
    blocks.rows.forEach(row => {
      console.log('  • Block', row.number, ':', row.hash.substring(0, 20) + '...');
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkData();