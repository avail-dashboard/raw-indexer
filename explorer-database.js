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
            max: parseInt(process.env.DB_POOL_MAX) || 50,
            min: parseInt(process.env.DB_POOL_MIN) || 5,
            idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
            acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
            createTimeoutMillis: 30000,
            query_timeout: 7200000
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
    // GENERIC BATCH PROCESSING UTILITIES
    // ================================

    // Universal batch function for all data types
    async executeBatch(dataArray, table, columns, transform, chunkSize, operation = 'INSERT', client = null) {
        if (!dataArray || dataArray.length === 0) return [];
        
        // Auto-chunk if needed
        if (dataArray.length > chunkSize) {
            const allResults = [];
            for (let i = 0; i < dataArray.length; i += chunkSize) {
                const chunk = dataArray.slice(i, i + chunkSize);
                const results = await this.executeBatch(chunk, table, columns, transform, chunkSize, operation, client);
                allResults.push(...results);
            }
            return allResults;
        }
        
        // Build batch query
        const valueGroups = [];
        const allParams = [];
        let paramIndex = 1;
        
        for (const item of dataArray) {
            const params = transform(item);
            allParams.push(...params);
            
            const placeholders = [];
            for (let i = 0; i < params.length; i++) {
                placeholders.push(`$${paramIndex++}`);
            }
            valueGroups.push(`(${placeholders.join(', ')})`);
        }
        
        let query;
        if (operation === 'UPSERT' && table === 'account_profiles') {
            query = `
                INSERT INTO ${table} (${columns.join(', ')}) 
                VALUES ${valueGroups.join(', ')}
                ON CONFLICT (account_id) DO UPDATE SET
                    display_name = COALESCE(EXCLUDED.display_name, account_profiles.display_name),
                    is_validator = EXCLUDED.is_validator,
                    is_nominator = EXCLUDED.is_nominator,
                    current_nonce = EXCLUDED.current_nonce,
                    last_activity_block = EXCLUDED.last_activity_block,
                    last_activity_timestamp = EXCLUDED.last_activity_timestamp
                RETURNING id;
            `;
        } else {
            query = `
                INSERT INTO ${table} (${columns.join(', ')}) 
                VALUES ${valueGroups.join(', ')}
                RETURNING id;
            `;
        }
        
        const result = await this.query(query, allParams, client);
        return result.rows.map(row => row.id);
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
                spec_name, impl_name, chain_name, node_version, chain_properties,
                digest_json, header_raw_hex, extraction_version
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
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
            blockData.specName || null,
            blockData.implName || null,
            blockData.chainName || null,
            blockData.nodeVersion || null,
            blockData.chainProperties ? this.safeBigIntStringify(blockData.chainProperties) : null,
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
                commitment_hex, proof_data, utilization_percentage, app_data_count,
                sample_data_proof, sample_row_data, kate_available, kate_extraction_note
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
            kateData.appDataCount || 0,
            kateData.sampleDataProof ? this.safeBigIntStringify(kateData.sampleDataProof) : null,
            kateData.sampleRowData ? this.safeBigIntStringify(kateData.sampleRowData) : null,
            kateData.kateAvailable !== undefined ? kateData.kateAvailable : true,
            kateData.kateExtractionNote || null
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertStorageState(storageData, client = null) {
        const query = `
            INSERT INTO storage_states (
                block_hash, block_number, system_data, balances_data, total_issuance,
                da_next_app_id, da_app_keys, da_data_submissions,
                session_validators, session_validator_count, staking_current_era,
                storage_extraction_note
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id;
        `;

        const params = [
            storageData.blockHash,
            this.prepareBigIntValue(storageData.blockNumber),
            storageData.systemData ? this.safeBigIntStringify(storageData.systemData) : null,
            storageData.balancesData ? this.safeBigIntStringify(storageData.balancesData) : null,
            this.prepareBigIntValue(storageData.totalIssuance || 0),
            this.prepareBigIntValue(storageData.daNextAppId || 0),
            storageData.daAppKeys ? this.safeBigIntStringify(storageData.daAppKeys) : null,
            storageData.daDataSubmissions ? this.safeBigIntStringify(storageData.daDataSubmissions) : null,
            storageData.sessionValidators ? this.safeBigIntStringify(storageData.sessionValidators) : null,
            storageData.sessionValidatorCount || 0,
            this.prepareBigIntValue(storageData.stakingCurrentEra || 0),
            storageData.storageExtractionNote || null
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertNetworkStatistics(networkData, client = null) {
        const query = `
            INSERT INTO network_statistics (
                block_hash, block_number, extrinsics_count, events_count,
                signed_extrinsics_count, unsigned_extrinsics_count,
                total_tips, total_fees, average_tip, average_fee,
                da_submissions_count, da_total_data_size, da_unique_apps_count,
                total_accounts_count, active_accounts_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id;
        `;

        const params = [
            networkData.blockHash,
            this.prepareBigIntValue(networkData.blockNumber),
            networkData.extrinsicsCount || 0,
            networkData.eventsCount || 0,
            networkData.signedExtrinsicsCount || 0,
            networkData.unsignedExtrinsicsCount || 0,
            this.prepareBigIntValue(networkData.totalTips || 0),
            this.prepareBigIntValue(networkData.totalFees || 0),
            this.prepareBigIntValue(networkData.averageTip || 0),
            this.prepareBigIntValue(networkData.averageFee || 0),
            networkData.daSubmissionsCount || 0,
            this.prepareBigIntValue(networkData.daTotalDataSize || 0),
            networkData.daUniqueAppsCount || 0,
            networkData.totalAccountsCount || 0,
            networkData.activeAccountsCount || 0
        ];

        const result = await this.query(query, params, client);
        return result.rows[0].id;
    }

    async insertBalancesSummary(balancesData, client = null) {
        const query = `
            INSERT INTO balances_summary (
                block_hash, block_number, total_issuance,
                total_balance_accounts, total_free_balance, total_reserved_balance, total_frozen_balance,
                balance_pages_loaded, balance_extraction_note
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id;
        `;

        const params = [
            balancesData.blockHash,
            this.prepareBigIntValue(balancesData.blockNumber),
            this.prepareBigIntValue(balancesData.totalIssuance || 0),
            balancesData.totalBalanceAccounts || 0,
            this.prepareBigIntValue(balancesData.totalFreeBalance || 0),
            this.prepareBigIntValue(balancesData.totalReservedBalance || 0),
            this.prepareBigIntValue(balancesData.totalFrozenBalance || 0),
            balancesData.balancePagesLoaded || 0,
            balancesData.balanceExtractionNote || null
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

    async insertExtrinsicsBatch(extrinsicsDataArray, client = null) {
        return this.executeBatch(
            extrinsicsDataArray,
            'extrinsic_data',
            ['block_hash', 'block_number', 'extrinsic_index', 'extrinsic_hash', 'is_signed', 'signer_account', 'method_pallet', 'method_name', 'nonce', 'tip', 'fee', 'success', 'error_message', 'method_args', 'raw_hex', 'length_bytes'],
            (item) => [
                item.blockHash,
                this.prepareBigIntValue(item.blockNumber),
                item.extrinsicIndex,
                item.extrinsicHash,
                item.isSigned,
                item.signerAccount || null,
                item.methodPallet,
                item.methodName,
                this.prepareBigIntValue(item.nonce),
                this.prepareBigIntValue(item.tip || 0),
                this.prepareBigIntValue(item.fee || 0),
                item.success !== undefined ? item.success : null,
                item.errorMessage || null,
                item.methodArgs ? this.safeBigIntStringify(item.methodArgs) : null,
                item.rawHex || null,
                item.lengthBytes || null
            ],
            1000,
            'INSERT',
            client
        );
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
        const chunkSize = eventsDataArray.length > 10000 ? 500 : 1000;
        
        return this.executeBatch(
            eventsDataArray,
            'event_data',
            ['block_hash', 'block_number', 'event_index', 'extrinsic_id', 'extrinsic_index', 'phase_type', 'phase_value', 'pallet', 'event_name', 'topics', 'raw_data'],
            (item) => [
                item.blockHash,
                this.prepareBigIntValue(item.blockNumber),
                item.eventIndex,
                item.extrinsicId || null,
                item.extrinsicIndex || null,
                item.phaseType || null,
                item.phaseValue || null,
                item.pallet,
                item.eventName,
                item.topics || [],
                item.rawData ? this.safeBigIntStringify(item.rawData) : null
            ],
            chunkSize,
            'INSERT',
            client
        );
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

    async upsertAccountProfilesBatch(accountDataArray, client = null) {
        return this.executeBatch(
            accountDataArray,
            'account_profiles',
            ['account_id', 'display_name', 'identity_judgement', 'is_validator', 'is_nominator', 'current_nonce', 'first_seen_block', 'first_seen_timestamp', 'last_activity_block', 'last_activity_timestamp'],
            (item) => [
                item.accountId,
                item.displayName || null,
                item.identityJudgement || null,
                item.isValidator || false,
                item.isNominator || false,
                this.prepareBigIntValue(item.currentNonce || 0),
                this.prepareBigIntValue(item.firstSeenBlock),
                item.firstSeenTimestamp || null,
                this.prepareBigIntValue(item.lastActivityBlock),
                item.lastActivityTimestamp || null
            ],
            2000,
            'UPSERT',
            client
        );
    }

    async insertBalanceHistoryBatch(balanceDataArray, client = null) {
        return this.executeBatch(
            balanceDataArray,
            'balance_history',
            ['account_id', 'block_hash', 'block_number', 'balance_free', 'balance_reserved', 'balance_frozen', 'nonce', 'consumers', 'providers', 'sufficients', 'free_change', 'reserved_change'],
            (item) => [
                item.accountId,
                item.blockHash,
                this.prepareBigIntValue(item.blockNumber),
                this.prepareBigIntValue(item.balanceFree),
                this.prepareBigIntValue(item.balanceReserved),
                this.prepareBigIntValue(item.balanceFrozen || 0),
                this.prepareBigIntValue(item.nonce),
                this.prepareBigIntValue(item.consumers || 0),
                this.prepareBigIntValue(item.providers || 0),
                this.prepareBigIntValue(item.sufficients || 0),
                this.prepareBigIntValue(item.freeChange || 0),
                this.prepareBigIntValue(item.reservedChange || 0)
            ],
            2000,
            'INSERT',
            client
        );
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

    async insertDataSubmissionsBatch(submissionDataArray, client = null) {
        return this.executeBatch(
            submissionDataArray,
            'data_submissions',
            ['block_hash', 'block_number', 'extrinsic_id', 'app_id', 'submitter_account', 'data_size', 'data_index', 'data_hash', 'proof_data', 'submission_fee'],
            (item) => [
                item.blockHash,
                this.prepareBigIntValue(item.blockNumber),
                item.extrinsicId || null,
                this.prepareBigIntValue(item.appId),
                item.submitterAccount,
                item.dataSize,
                item.dataIndex || null,
                item.dataHash || null,
                item.proofData ? this.safeBigIntStringify(item.proofData) : null,
                this.prepareBigIntValue(item.submissionFee || 0)
            ],
            1000,
            'INSERT',
            client
        );
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

    async insertTransferEventsBatch(transferDataArray, client = null) {
        return this.executeBatch(
            transferDataArray,
            'transfer_events',
            ['block_hash', 'block_number', 'extrinsic_id', 'event_id', 'from_account', 'to_account', 'amount', 'transfer_type', 'success', 'fee_paid', 'tip_paid'],
            (item) => [
                item.blockHash,
                this.prepareBigIntValue(item.blockNumber),
                item.extrinsicId || null,
                item.eventId || null,
                item.fromAccount,
                item.toAccount,
                this.prepareBigIntValue(item.amount),
                item.transferType || 'Transfer',
                item.success !== undefined ? item.success : true,
                this.prepareBigIntValue(item.feePaid || 0),
                this.prepareBigIntValue(item.tipPaid || 0)
            ],
            1000,
            'INSERT',
            client
        );
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

    async insertStakingEventsBatch(stakingDataArray, client = null) {
        return this.executeBatch(
            stakingDataArray,
            'staking_events',
            ['block_hash', 'block_number', 'event_id', 'event_type', 'validator_account', 'nominator_account', 'amount', 'era_index', 'event_data'],
            (item) => [
                item.blockHash,
                this.prepareBigIntValue(item.blockNumber),
                item.eventId || null,
                item.eventType,
                item.validatorAccount || null,
                item.nominatorAccount || null,
                this.prepareBigIntValue(item.amount || 0),
                this.prepareBigIntValue(item.eraIndex),
                item.eventData ? this.safeBigIntStringify(item.eventData) : null
            ],
            1000,
            'INSERT',
            client
        );
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