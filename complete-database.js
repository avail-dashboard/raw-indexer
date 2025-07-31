const { Pool } = require('pg');

class CompleteDatabaseClient {
  constructor(config) {
    this.pool = new Pool(config);
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log('Connecting to PostgreSQL...');
      
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

  async insertCompleteBlock(blockData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Insert block
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

      // 2. Insert spec version
      if (blockData.specVersion) {
        await this.insertSpecVersion(client, blockId, blockData.specVersion);
      }

      // 3. Insert session info
      if (blockData.sessionInfo) {
        await this.insertSession(client, blockId, blockData.sessionInfo);
      }

      // 4. Insert header extensions (Avail DA)
      const headerExtensionIds = {};
      if (blockData.headerExtensions) {
        for (const headerExt of blockData.headerExtensions) {
          const extId = await this.insertHeaderExtension(client, blockId, headerExt);
          headerExtensionIds[headerExt.hash] = extId;
        }
      }

      // 5. Insert extrinsics
      const extrinsicIds = [];
      for (const ext of blockData.extrinsics) {
        const extId = await this.insertExtrinsic(client, blockId, ext);
        extrinsicIds.push(extId);
      }

      // 6. Insert events
      for (const event of blockData.events) {
        await this.insertEvent(client, blockId, event, extrinsicIds);
      }

      // 7. Insert app lookups (Avail DA)
      if (blockData.appLookups) {
        for (const appLookup of blockData.appLookups) {
          await this.insertAppLookup(client, blockId, appLookup, headerExtensionIds);
        }
      }

      // 8. Insert commitments (Avail DA)
      if (blockData.commitments) {
        for (const commitment of blockData.commitments) {
          await this.insertCommitment(client, blockId, commitment, headerExtensionIds);
        }
      }

      // 9. Insert logs
      if (blockData.logs) {
        for (const log of blockData.logs) {
          await this.insertLog(client, blockId, log);
        }
      }

      // 10. Insert data submissions (Avail DA)
      if (blockData.dataSubmissions) {
        for (const submission of blockData.dataSubmissions) {
          await this.insertDataSubmission(client, blockId, submission, extrinsicIds);
        }
      }

      // 11. Process account updates
      if (blockData.accountUpdates) {
        await this.processAccountUpdates(client, blockId, blockData.accountUpdates, blockData.number);
      }

      await client.query('COMMIT');
      console.log(`  ✓ Complete block ${blockData.number} processing finished`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`  ✗ Error processing complete block ${blockData.number}:`, error.message);
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

  async insertHeaderExtension(client, blockId, headerExt) {
    const query = `
      INSERT INTO header_extensions (block_id, hash, commitment_data, app_lookup_data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (hash) DO UPDATE SET
        commitment_data = EXCLUDED.commitment_data,
        app_lookup_data = EXCLUDED.app_lookup_data
      RETURNING id
    `;
    
    const result = await client.query(query, [
      blockId,
      headerExt.hash,
      JSON.stringify({
        logIndex: headerExt.logIndex,
        logType: headerExt.logType,
        data: headerExt.data,
        commitmentData: headerExt.commitmentData
      }),
      JSON.stringify(headerExt.appLookupData)
    ]);
    
    return result.rows[0].id;
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
    // Map event to extrinsic based on phase
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
    
    // Process transfer events
    if (event.section === 'balances' && event.method === 'Transfer') {
      await this.insertTransferEntity(client, blockId, extrinsicId, result.rows[0].id, event);
    }
    
    return result.rows[0].id;
  }

  async insertAppLookup(client, blockId, appLookup, headerExtensionIds) {
    // Try to find matching header extension
    let headerExtensionId = null;
    const firstExtId = Object.values(headerExtensionIds)[0];
    if (firstExtId) {
      headerExtensionId = firstExtId;
    }

    const query = `
      INSERT INTO app_lookups (block_id, header_extension_id, app_id, size, index_value)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `;
    
    try {
      await client.query(query, [
        blockId,
        headerExtensionId,
        parseInt(appLookup.id) || 0,
        appLookup.size || 0,
        appLookup.indexValue || 0
      ]);
    } catch (e) {
      // Skip invalid app lookups
      console.warn(`Skipping app lookup: ${e.message}`);
    }
  }

  async insertCommitment(client, blockId, commitment, headerExtensionIds) {
    // Try to find matching header extension
    let headerExtensionId = null;
    const firstExtId = Object.values(headerExtensionIds)[0];
    if (firstExtId) {
      headerExtensionId = firstExtId;
    }

    const query = `
      INSERT INTO commitments (block_id, header_extension_id, commitment, length)
      VALUES ($1, $2, $3, $4)
    `;
    
    await client.query(query, [
      blockId,
      headerExtensionId,
      commitment.commitment,
      commitment.length
    ]);
  }

  async insertLog(client, blockId, log) {
    const query = `
      INSERT INTO logs (block_id, log_type, engine, data)
      VALUES ($1, $2, $3, $4)
    `;
    
    await client.query(query, [
      blockId,
      log.logType,
      log.engine,
      JSON.stringify(log.data)
    ]);
  }

  async insertDataSubmission(client, blockId, submission, extrinsicIds) {
    let extrinsicId = null;
    if (submission.extrinsicIndex !== undefined && submission.extrinsicIndex < extrinsicIds.length) {
      extrinsicId = extrinsicIds[submission.extrinsicIndex];
    }

    const query = `
      INSERT INTO data_submissions (block_id, extrinsic_id, app_id, data_length, data_hash)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    try {
      await client.query(query, [
        blockId,
        extrinsicId,
        parseInt(submission.appId) || 0,
        parseInt(submission.dataLength) || 0,
        null // data_hash can be computed later if needed
      ]);
    } catch (e) {
      console.warn(`Skipping data submission: ${e.message}`);
    }
  }

  async insertTransferEntity(client, blockId, extrinsicId, eventId, event) {
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

  async processAccountUpdates(client, blockId, accountUpdates, blockNumber) {
    for (const update of accountUpdates) {
      // Insert into accoun_to_update_values
      const accountUpdateQuery = `
        INSERT INTO accoun_to_update_values (block_id, account_id, update_data)
        VALUES ($1, $2, $3)
      `;
      
      const accountId = this.extractAccountFromUpdate(update);
      if (accountId) {
        await client.query(accountUpdateQuery, [
          blockId,
          accountId,
          JSON.stringify(update)
        ]);

        // Update comprehensive account entity
        await this.updateAccountEntity(client, blockId, accountId, update, blockNumber);
      }
    }
  }

  extractAccountFromUpdate(update) {
    if (update.updateData?.account) return update.updateData.account;
    if (update.data?.[0]) return update.data[0];
    if (update.updateData?.args?.[0]) return update.updateData.args[0];
    return null;
  }

  async updateAccountEntity(client, blockId, accountId, update, blockNumber) {
    let balance = null;
    let nonce = null;
    
    // Extract balance from update
    if (update.type === 'balance_event' && update.method === 'Endowed') {
      balance = update.data[1] || '0';
    }
    
    const query = `
      INSERT INTO account_entities (id, block_id, nonce, balance, last_updated_block)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        block_id = EXCLUDED.block_id,
        nonce = COALESCE(EXCLUDED.nonce, account_entities.nonce),
        balance = COALESCE(EXCLUDED.balance, account_entities.balance),
        last_updated_block = EXCLUDED.last_updated_block,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await client.query(query, [
      accountId,
      blockId,
      nonce,
      balance || '0',
      blockNumber
    ]);
  }

  async getCompleteStats() {
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
    
    const results = {};
    
    for (const query of queries) {
      const result = await this.pool.query(query);
      Object.assign(results, result.rows[0]);
    }
    
    return results;
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }
}

module.exports = CompleteDatabaseClient;