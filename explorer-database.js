// Enhanced Database Client for Avail DA Explorer
// Handles BigInt-safe operations and comprehensive data storage

const { Pool } = require('pg');
require('dotenv').config();

class ExplorerDatabase {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            max: parseInt(process.env.DB_POOL_MAX) || 10,
            min: parseInt(process.env.DB_POOL_MIN) || 1,
            idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
            connectionTimeoutMillis: 30000,
            query_timeout: 300000
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected database pool error:', err);
        });
    }

    // BigInt-safe JSON serialization
    safeBigIntStringify(obj) {
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        });
    }

    // Convert BigInt values to strings for database storage
    prepareBigIntValue(value) {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        if (value && typeof value.toBigInt === 'function') {
            return value.toBigInt().toString();
        }
        if (value && typeof value.toString === 'function' && value.toString().match(/^\d+$/)) {
            return value.toString();
        }
        return value;
    }

    // Execute query with proper error handling
    async query(text, params = [], client = null) {
        if (client) {
            // Use provided transaction client
            try {
                const result = await client.query(text, params);
                return result;
            } catch (error) {
                console.error('Database query error:', error.message);
                console.error('Query:', text);
                console.error('Params:', params);
                throw error;
            }
        } else {
            // Get new connection from pool
            const poolClient = await this.pool.connect();
            try {
                const result = await poolClient.query(text, params);
                return result;
            } catch (error) {
                console.error('Database query error:', error.message);
                console.error('Query:', text);
                console.error('Params:', params);
                throw error;
            } finally {
                poolClient.release();
            }
        }
    }

    // Transaction wrapper
    async withTransaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Transaction error:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    // ================================
    // BLOCK DATA STORAGE
    // ================================

    async insertBlockHeader(blockData, client = null) {
        const query = `
            INSERT INTO block_headers (
                block_number, block_hash, parent_hash, state_root, extrinsics_root,
                timestamp_utc, author_account, is_finalized, finalization_delay_ms,
                extrinsics_count, events_count, data_submissions_count, 
                total_fees, total_tips,
                spec_version, impl_version, authoring_version, transaction_version, state_version,
                digest_json, header_raw_hex, extraction_version
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
                $15, $16, $17, $18, $19, $20, $21, $22
            )
            RETURNING id;
        `;

        const params = [
            this.prepareBigIntValue(blockData.blockNumber),
            blockData.blockHash,
            blockData.parentHash,
            blockData.stateRoot,
            blockData.extrinsicsRoot,
            blockData.timestamp || null,
            blockData.authorAccount || null,
            blockData.isFinalized || false,
            blockData.finalizationDelay || null,
            blockData.extrinsicsCount || 0,
            blockData.eventsCount || 0,
            blockData.dataSubmissionsCount || 0,
            this.prepareBigIntValue(blockData.totalFees || 0),
            this.prepareBigIntValue(blockData.totalTips || 0),
            this.prepareBigIntValue(blockData.specVersion),
            this.prepareBigIntValue(blockData.implVersion),
            this.prepareBigIntValue(blockData.authoringVersion),
            this.prepareBigIntValue(blockData.transactionVersion),
            this.prepareBigIntValue(blockData.stateVersion),
            blockData.digestJson ? this.safeBigIntStringify(blockData.digestJson) : null,
            blockData.headerRawHex || null,
            '2.0.0'
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertKateCommitment(kateData, client = null) {
        const query = `
            INSERT INTO kate_commitments (
                block_hash, block_number, rows, cols, data_root, block_length,
                commitment_hex, proof_data, utilization_percentage, app_data_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;

        const params = [
            kateData.blockHash,
            this.prepareBigIntValue(kateData.blockNumber),
            kateData.rows || null,
            kateData.cols || null,
            kateData.dataRoot || null,
            this.prepareBigIntValue(kateData.blockLength),
            kateData.commitmentHex || null,
            kateData.proofData ? this.safeBigIntStringify(kateData.proofData) : null,
            kateData.utilizationPercentage || 0,
            kateData.appDataCount || 0
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    // ================================
    // EXTRINSIC AND EVENT STORAGE
    // ================================

    async insertExtrinsic(extrinsicData, client = null) {
        const query = `
            INSERT INTO extrinsic_data (
                block_hash, block_number, extrinsic_index, extrinsic_hash,
                is_signed, signer_account, method_pallet, method_name,
                nonce, tip, fee, success, error_message,
                method_args, raw_hex, length_bytes
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            RETURNING id;
        `;

        const params = [
            extrinsicData.blockHash,
            this.prepareBigIntValue(extrinsicData.blockNumber),
            extrinsicData.extrinsicIndex,
            extrinsicData.extrinsicHash,
            extrinsicData.isSigned,
            extrinsicData.signerAccount || null,
            extrinsicData.methodPallet,
            extrinsicData.methodName,
            this.prepareBigIntValue(extrinsicData.nonce),
            this.prepareBigIntValue(extrinsicData.tip || 0),
            this.prepareBigIntValue(extrinsicData.fee || 0),
            extrinsicData.success !== undefined ? extrinsicData.success : null,
            extrinsicData.errorMessage || null,
            extrinsicData.methodArgs ? this.safeBigIntStringify(extrinsicData.methodArgs) : null,
            extrinsicData.rawHex || null,
            extrinsicData.lengthBytes || null
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertEvent(eventData, client = null) {
        const query = `
            INSERT INTO event_data (
                block_hash, block_number, event_index, extrinsic_id, extrinsic_index,
                phase_type, phase_value, pallet, event_name, topics, raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id;
        `;

        const params = [
            eventData.blockHash,
            this.prepareBigIntValue(eventData.blockNumber),
            eventData.eventIndex,
            eventData.extrinsicId || null,
            eventData.extrinsicIndex || null,
            eventData.phaseType || null,
            eventData.phaseValue || null,
            eventData.pallet,
            eventData.eventName,
            eventData.topics || [],
            eventData.rawData ? this.safeBigIntStringify(eventData.rawData) : null
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertEventsBatch(eventsDataArray, client = null) {
        if (!eventsDataArray || eventsDataArray.length === 0) {
            return [];
        }

        // Build batch INSERT query with VALUES for all events
        const valueGroups = [];
        const allParams = [];
        let paramIndex = 1;

        for (const eventData of eventsDataArray) {
            const params = [
                eventData.blockHash,
                this.prepareBigIntValue(eventData.blockNumber),
                eventData.eventIndex,
                eventData.extrinsicId || null,
                eventData.extrinsicIndex || null,
                eventData.phaseType || null,
                eventData.phaseValue || null,
                eventData.pallet,
                eventData.eventName,
                eventData.topics || [],
                eventData.rawData ? this.safeBigIntStringify(eventData.rawData) : null
            ];

            allParams.push(...params);
            
            // Create parameter placeholders for this event (11 params)
            const placeholders = [];
            for (let i = 0; i < 11; i++) {
                placeholders.push(`$${paramIndex++}`);
            }
            valueGroups.push(`(${placeholders.join(', ')})`);
        }

        const query = `
            INSERT INTO event_data (
                block_hash, block_number, event_index, extrinsic_id, extrinsic_index,
                phase_type, phase_value, pallet, event_name, topics, raw_data
            ) VALUES ${valueGroups.join(', ')}
            RETURNING id;
        `;

        const result = await this.query(query, allParams, client);
        return result.rows.map(row => row.id);
    }

    // linkExtrinsicEvent removed: use event_data.extrinsic_id foreign key instead

    // ================================
    // ACCOUNT AND BALANCE MANAGEMENT
    // ================================

    async upsertAccountProfile(accountData, client = null) {
        const query = `
            INSERT INTO account_profiles (
                account_id, display_name, identity_judgement, is_validator, is_nominator,
                current_nonce, first_seen_block, first_seen_timestamp, last_activity_block, last_activity_timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (account_id) DO UPDATE SET
                display_name = COALESCE(EXCLUDED.display_name, account_profiles.display_name),
                identity_judgement = COALESCE(EXCLUDED.identity_judgement, account_profiles.identity_judgement),
                is_validator = EXCLUDED.is_validator,
                is_nominator = EXCLUDED.is_nominator,
                current_nonce = EXCLUDED.current_nonce,
                last_activity_block = EXCLUDED.last_activity_block,
                last_activity_timestamp = EXCLUDED.last_activity_timestamp
            RETURNING id;
        `;

        const params = [
            accountData.accountId,
            accountData.displayName || null,
            accountData.identityJudgement || null,
            accountData.isValidator || false,
            accountData.isNominator || false,
            this.prepareBigIntValue(accountData.currentNonce || 0),
            this.prepareBigIntValue(accountData.firstSeenBlock),
            accountData.firstSeenTimestamp || null,
            this.prepareBigIntValue(accountData.lastActivityBlock),
            accountData.lastActivityTimestamp || null
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertBalanceHistory(balanceData, client = null) {
        const query = `
            INSERT INTO balance_history (
                account_id, block_hash, block_number, balance_free, balance_reserved, balance_frozen,
                nonce, consumers, providers, sufficients, free_change, reserved_change
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id;
        `;

        const params = [
            balanceData.accountId,
            balanceData.blockHash,
            this.prepareBigIntValue(balanceData.blockNumber),
            this.prepareBigIntValue(balanceData.balanceFree),
            this.prepareBigIntValue(balanceData.balanceReserved),
            this.prepareBigIntValue(balanceData.balanceFrozen || 0),
            this.prepareBigIntValue(balanceData.nonce),
            this.prepareBigIntValue(balanceData.consumers || 0),
            this.prepareBigIntValue(balanceData.providers || 0),
            this.prepareBigIntValue(balanceData.sufficients || 0),
            this.prepareBigIntValue(balanceData.freeChange || 0),
            this.prepareBigIntValue(balanceData.reservedChange || 0)
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    // ================================
    // DATA SUBMISSIONS AND TRANSFERS
    // ================================

    async insertDataSubmission(submissionData, client = null) {
        const query = `
            INSERT INTO data_submissions (
                block_hash, block_number, extrinsic_id, app_id, submitter_account,
                data_size, data_index, data_hash, proof_data, submission_fee
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;

        const params = [
            submissionData.blockHash,
            this.prepareBigIntValue(submissionData.blockNumber),
            submissionData.extrinsicId || null,
            this.prepareBigIntValue(submissionData.appId),
            submissionData.submitterAccount,
            submissionData.dataSize,
            submissionData.dataIndex || null,
            submissionData.dataHash || null,
            submissionData.proofData ? this.safeBigIntStringify(submissionData.proofData) : null,
            this.prepareBigIntValue(submissionData.submissionFee || 0)
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertTransferEvent(transferData, client = null) {
        const query = `
            INSERT INTO transfer_events (
                block_hash, block_number, extrinsic_id, event_id,
                from_account, to_account, amount, transfer_type, success, fee_paid, tip_paid
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id;
        `;

        const params = [
            transferData.blockHash,
            this.prepareBigIntValue(transferData.blockNumber),
            transferData.extrinsicId || null,
            transferData.eventId || null,
            transferData.fromAccount,
            transferData.toAccount,
            this.prepareBigIntValue(transferData.amount),
            transferData.transferType || 'Transfer',
            transferData.success !== undefined ? transferData.success : true,
            this.prepareBigIntValue(transferData.feePaid || 0),
            this.prepareBigIntValue(transferData.tipPaid || 0)
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertStakingEvent(stakingData, client = null) {
        const query = `
            INSERT INTO staking_events (
                block_hash, block_number, event_id, event_type, validator_account,
                nominator_account, amount, era_index, event_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id;
        `;

        const params = [
            stakingData.blockHash,
            this.prepareBigIntValue(stakingData.blockNumber),
            stakingData.eventId || null,
            stakingData.eventType,
            stakingData.validatorAccount || null,
            stakingData.nominatorAccount || null,
            this.prepareBigIntValue(stakingData.amount || 0),
            this.prepareBigIntValue(stakingData.eraIndex),
            stakingData.eventData ? this.safeBigIntStringify(stakingData.eventData) : null
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    // ================================
    // ANALYTICS OPERATIONS REMOVED
    // ================================
    // Analytics functions removed - storing only raw blockchain data

    // ================================
    // UTILITY METHODS
    // ================================

    async getLastProcessedBlock() {
        const query = 'SELECT MAX(block_number) as last_block FROM block_headers';
        const result = await this.query(query);
        return result.rows[0].last_block ? parseInt(result.rows[0].last_block) : null;
    }

    async blockExists(blockNumber) {
        const query = 'SELECT 1 FROM block_headers WHERE block_number = $1';
        const result = await this.query(query, [this.prepareBigIntValue(blockNumber)]);
        return result.rows.length > 0;
    }

    async getProcessingStatistics() {
        const queries = {
            totalBlocks: 'SELECT COUNT(*) as count FROM block_headers',
            totalExtrinsics: 'SELECT COUNT(*) as count FROM extrinsic_data',
            totalEvents: 'SELECT COUNT(*) as count FROM event_data',
            totalAccounts: 'SELECT COUNT(*) as count FROM account_profiles',
            totalTransfers: 'SELECT COUNT(*) as count FROM transfer_events',
            totalDataSubmissions: 'SELECT COUNT(*) as count FROM data_submissions'
        };

        const stats = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.query(query);
            stats[key] = parseInt(result.rows[0].count);
        }

        return stats;
    }

    async close() {
        await this.pool.end();
        console.log('🔌 Database connection pool closed');
    }

    // Health check
    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health');
            return result.rows[0].health === 1;
        } catch (error) {
            console.error('Database health check failed:', error.message);
            return false;
        }
    }
}

module.exports = { ExplorerDatabase };