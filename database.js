const { Pool } = require('pg');

class DatabaseClient {
  constructor(config) {
    this.pool = new Pool(config);
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log('Connecting to PostgreSQL...');
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      console.log('✓ Connected to PostgreSQL');
      
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Disconnected from PostgreSQL');
    }
  }

  async insertBlock(blockData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert block
      const blockQuery = `
        INSERT INTO blocks (hash, number, parent_hash, state_root, extrinsics_root, timestamp, author)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (hash) DO UPDATE SET
          number = EXCLUDED.number,
          parent_hash = EXCLUDED.parent_hash,
          state_root = EXCLUDED.state_root,
          extrinsics_root = EXCLUDED.extrinsics_root,
          timestamp = EXCLUDED.timestamp,
          author = EXCLUDED.author
        RETURNING id
      `;
      
      const blockResult = await client.query(blockQuery, [
        blockData.hash,
        blockData.number,
        blockData.parentHash,
        blockData.stateRoot,
        blockData.extrinsicsRoot,
        blockData.timestamp,
        blockData.author
      ]);
      
      const blockId = blockResult.rows[0].id;
      console.log(`  → Inserted block ${blockData.number} (id: ${blockId})`);

      // Insert spec version if available
      if (blockData.specVersion) {
        await this.insertSpecVersion(client, blockId, blockData.specVersion);
      }

      // Insert session info if available
      if (blockData.sessionInfo) {
        await this.insertSession(client, blockId, blockData.sessionInfo);
      }

      // Insert extrinsics
      const extrinsicIds = [];
      for (const ext of blockData.extrinsics) {
        const extId = await this.insertExtrinsic(client, blockId, ext);
        extrinsicIds.push(extId);
      }

      // Insert events
      for (const event of blockData.events) {
        await this.insertEvent(client, blockId, event, extrinsicIds);
      }

      // Insert Avail DA-specific data
      if (blockData.availDAData) {
        await this.insertAvailDAData(client, blockId, blockData.availDAData);
      }

      // Process account updates
      if (blockData.accountUpdates) {
        await this.processAccountUpdates(client, blockId, blockData.accountUpdates);
      }

      await client.query('COMMIT');
      console.log(`  ✓ Block ${blockData.number} processing complete`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`  ✗ Error processing block ${blockData.number}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async insertSpecVersion(client, blockId, specVersion) {
    const query = `
      INSERT INTO spec_versions (block_id, spec_version, impl_version, impl_name, authoring_version, transaction_version)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `;
    
    await client.query(query, [
      blockId,
      specVersion.specVersion,
      specVersion.implVersion,
      specVersion.implName,
      specVersion.authoringVersion,
      specVersion.transactionVersion
    ]);
  }

  async insertSession(client, blockId, sessionInfo) {
    const sessionId = `session_${sessionInfo.index}`;
    const query = `
      INSERT INTO sessions (id, block_id, session_index, validators)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `;
    
    await client.query(query, [
      sessionId,
      blockId,
      sessionInfo.index,
      JSON.stringify(sessionInfo.validators)
    ]);
  }

  async insertExtrinsic(client, blockId, extrinsic) {
    const query = `
      INSERT INTO extrinsics (block_id, hash, index, version, signature, method, section, args, tip, success, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (hash) DO UPDATE SET
        block_id = EXCLUDED.block_id,
        index = EXCLUDED.index,
        version = EXCLUDED.version,
        signature = EXCLUDED.signature,
        method = EXCLUDED.method,
        section = EXCLUDED.section,
        args = EXCLUDED.args,
        tip = EXCLUDED.tip,
        success = EXCLUDED.success,
        error = EXCLUDED.error
      RETURNING id
    `;
    
    const result = await client.query(query, [
      blockId,
      extrinsic.hash,
      extrinsic.index,
      extrinsic.version,
      extrinsic.signature ? JSON.stringify(extrinsic.signature) : null,
      extrinsic.method,
      extrinsic.section,
      JSON.stringify(extrinsic.args),
      extrinsic.tip,
      extrinsic.success,
      extrinsic.error ? JSON.stringify(extrinsic.error) : null
    ]);
    
    return result.rows[0].id;
  }

  async insertEvent(client, blockId, event, extrinsicIds) {
    // Try to map event to extrinsic based on phase
    let extrinsicId = null;
    if (event.phase.includes('ApplyExtrinsic')) {
      const extIndex = parseInt(event.phase.match(/\d+/)[0]);
      if (extIndex < extrinsicIds.length) {
        extrinsicId = extrinsicIds[extIndex];
      }
    }

    const query = `
      INSERT INTO events (block_id, extrinsic_id, index, phase, method, section, data, topics)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (block_id, index) DO UPDATE SET
        extrinsic_id = EXCLUDED.extrinsic_id,
        phase = EXCLUDED.phase,
        method = EXCLUDED.method,
        section = EXCLUDED.section,
        data = EXCLUDED.data,
        topics = EXCLUDED.topics
      RETURNING id
    `;
    
    const result = await client.query(query, [
      blockId,
      extrinsicId,
      event.index,
      event.phase,
      event.method,
      event.section,
      JSON.stringify(event.data),
      JSON.stringify(event.topics)
    ]);
    
    // Process transfer events to create transfer entities
    if (event.section === 'balances' && event.method === 'Transfer') {
      await this.insertTransferEntity(client, blockId, extrinsicId, result.rows[0].id, event);
    }
    
    return result.rows[0].id;
  }

  async insertTransferEntity(client, blockId, extrinsicId, eventId, event) {
    // Extract transfer data from event
    // Format: [from, to, amount]
    if (event.data && event.data.length >= 3) {
      const query = `
        INSERT INTO transfer_entities (block_id, extrinsic_id, event_id, from_account, to_account, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(query, [
        blockId,
        extrinsicId,
        eventId,
        event.data[0], // from
        event.data[1], // to
        event.data[2]  // amount
      ]);
    }
  }

  async getStats() {
    const queries = [
      'SELECT COUNT(*) as blocks FROM blocks',
      'SELECT COUNT(*) as extrinsics FROM extrinsics',
      'SELECT COUNT(*) as events FROM events',
      'SELECT COUNT(*) as transfers FROM transfer_entities',
      'SELECT MIN(number) as min_block, MAX(number) as max_block FROM blocks'
    ];
    
    const results = {};
    
    for (const query of queries) {
      const result = await this.pool.query(query);
      Object.assign(results, result.rows[0]);
    }
    
    return results;
  }

  async insertAvailDAData(client, blockId, availDAData) {
    // Insert header extensions
    if (availDAData.headerExtensions) {
      const query = `
        INSERT INTO header_extensions (block_id, hash, commitment_data)
        VALUES ($1, $2, $3)
        ON CONFLICT (hash) DO NOTHING
      `;
      
      await client.query(query, [
        blockId,
        availDAData.headerExtensions.hash,
        JSON.stringify(availDAData.headerExtensions.data)
      ]);
    }

    // Insert app lookups
    for (const appLookup of availDAData.appLookups) {
      const query = `
        INSERT INTO app_lookups (block_id, header_extension_id, app_id, size, index_value)
        VALUES ($1, NULL, $2, 0, 0)
        ON CONFLICT DO NOTHING
      `;
      
      try {
        await client.query(query, [blockId, parseInt(appLookup.appId)]);
      } catch (e) {
        // Skip if app_id is not a valid integer
      }
    }

    // Insert data submissions from account updates
    const dataSubmissions = availDAData.dataSubmissions || [];
    for (const submission of dataSubmissions) {
      const query = `
        INSERT INTO data_submissions (block_id, extrinsic_id, app_id, data_length)
        VALUES ($1, $2, $3, $4)
      `;
      
      await client.query(query, [
        blockId,
        submission.extrinsicId || null,
        submission.appId,
        submission.dataLength
      ]);
    }
  }

  async processAccountUpdates(client, blockId, accountUpdates) {
    for (const update of accountUpdates) {
      if (update.type === 'transfer') {
        // Transfer already handled in insertEvent, but let's track account states
        await this.updateAccountEntity(client, blockId, update.from, null, update.blockNumber);
        await this.updateAccountEntity(client, blockId, update.to, null, update.blockNumber);
      } else if (update.type === 'endowed') {
        await this.updateAccountEntity(client, blockId, update.account, update.balance, update.blockNumber);
      } else if (update.type === 'data_submission') {
        // Insert into data_submissions table
        const query = `
          INSERT INTO data_submissions (block_id, app_id, data_length)
          VALUES ($1, $2, $3)
        `;
        
        try {
          await client.query(query, [
            blockId,
            parseInt(update.appId),
            parseInt(update.dataLength)
          ]);
        } catch (e) {
          // Skip if values are not valid integers
        }
      }
    }
  }

  async updateAccountEntity(client, blockId, accountId, balance, blockNumber) {
    const query = `
      INSERT INTO account_entities (id, block_id, balance, last_updated_block)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        block_id = EXCLUDED.block_id,
        balance = COALESCE(EXCLUDED.balance, account_entities.balance),
        last_updated_block = EXCLUDED.last_updated_block,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await client.query(query, [
      accountId,
      blockId,
      balance || '0',
      blockNumber
    ]);
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }
}

module.exports = DatabaseClient;