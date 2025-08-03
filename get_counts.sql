-- Query to get the count of all the records in each table
SELECT 'transfer_events' AS table_name, COUNT(*) AS record_count FROM transfer_events
UNION ALL
SELECT 'staking_events' AS table_name, COUNT(*) AS record_count FROM staking_events
UNION ALL
SELECT 'data_submissions' AS table_name, COUNT(*) AS record_count FROM data_submissions
UNION ALL
SELECT 'balance_history' AS table_name, COUNT(*) AS record_count FROM balance_history
UNION ALL
SELECT 'account_profiles' AS table_name, COUNT(*) AS record_count FROM account_profiles
UNION ALL
SELECT 'event_data' AS table_name, COUNT(*) AS record_count FROM event_data
UNION ALL
SELECT 'extrinsic_data' AS table_name, COUNT(*) AS record_count FROM extrinsic_data
UNION ALL
SELECT 'app_registrations' AS table_name, COUNT(*) AS record_count FROM app_registrations
UNION ALL
SELECT 'kate_commitments' AS table_name, COUNT(*) AS record_count FROM kate_commitments
UNION ALL
SELECT 'block_headers' AS table_name, COUNT(*) AS record_count FROM block_headers
UNION ALL
SELECT 'schema_migrations' AS table_name, COUNT(*) AS record_count FROM schema_migrations;

-- Query to find empty columns in each table
WITH all_empty_columns AS (
    -- block_headers
    SELECT 'block_headers' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE id IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'parent_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE parent_hash IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'state_root' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE state_root IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'extrinsics_root' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE extrinsics_root IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'timestamp_utc' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE timestamp_utc IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'author_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE author_account IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'is_finalized' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE is_finalized IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'finalization_delay_ms' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE finalization_delay_ms IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'extrinsics_count' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE extrinsics_count IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'events_count' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE events_count IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'data_submissions_count' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE data_submissions_count IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'total_fees' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE total_fees IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'total_tips' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE total_tips IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'spec_version' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE spec_version IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'impl_version' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE impl_version IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'authoring_version' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE authoring_version IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'transaction_version' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE transaction_version IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'state_version' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE state_version IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'header_raw_hex' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE header_raw_hex IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'indexed_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE indexed_at IS NOT NULL) UNION ALL
    SELECT 'block_headers' AS table_name, 'extraction_version' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM block_headers WHERE extraction_version IS NOT NULL) UNION ALL
    -- kate_commitments
    SELECT 'kate_commitments' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE id IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'rows' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE "rows" IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'cols' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE cols IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'data_root' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE data_root IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'block_length' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE block_length IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'commitment_hex' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE commitment_hex IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'proof_data' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE proof_data IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'utilization_percentage' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE utilization_percentage IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'app_data_count' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE app_data_count IS NOT NULL) UNION ALL
    SELECT 'kate_commitments' AS table_name, 'created_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM kate_commitments WHERE created_at IS NOT NULL) UNION ALL
    -- app_registrations
    SELECT 'app_registrations' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE id IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'app_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE app_id IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'app_key' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE app_key IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'owner_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE owner_account IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'registered_at_block' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE registered_at_block IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'registered_at_timestamp' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE registered_at_timestamp IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'app_name' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE app_name IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'app_description' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE app_description IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'app_data' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE app_data IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'total_submissions' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE total_submissions IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'total_data_size' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE total_data_size IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'last_submission_block' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE last_submission_block IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'last_submission_timestamp' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE last_submission_timestamp IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'created_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE created_at IS NOT NULL) UNION ALL
    SELECT 'app_registrations' AS table_name, 'updated_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM app_registrations WHERE updated_at IS NOT NULL) UNION ALL
    -- extrinsic_data
    SELECT 'extrinsic_data' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE id IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'extrinsic_index' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE extrinsic_index IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'extrinsic_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE extrinsic_hash IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'is_signed' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE is_signed IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'signer_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE signer_account IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'method_pallet' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE method_pallet IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'method_name' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE method_name IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'nonce' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE nonce IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'tip' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE tip IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'fee' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE fee IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'success' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE success IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'error_message' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE error_message IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'method_args' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE method_args IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'raw_hex' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE raw_hex IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'length_bytes' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE length_bytes IS NOT NULL) UNION ALL
    SELECT 'extrinsic_data' AS table_name, 'indexed_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM extrinsic_data WHERE indexed_at IS NOT NULL) UNION ALL
    -- event_data
    SELECT 'event_data' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE id IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'event_index' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE event_index IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'extrinsic_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE extrinsic_id IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'extrinsic_index' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE extrinsic_index IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'phase_type' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE phase_type IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'phase_value' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE phase_value IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'pallet' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE pallet IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'event_name' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE event_name IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'topics' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE topics IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'raw_data' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE raw_data IS NOT NULL) UNION ALL
    SELECT 'event_data' AS table_name, 'indexed_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM event_data WHERE indexed_at IS NOT NULL) UNION ALL
    -- account_profiles
    SELECT 'account_profiles' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE id IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'account_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE account_id IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'display_name' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE display_name IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'identity_judgement' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE identity_judgement IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'is_validator' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE is_validator IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'is_nominator' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE is_nominator IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'current_nonce' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE current_nonce IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'total_extrinsics_sent' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE total_extrinsics_sent IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'total_extrinsics_received' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE total_extrinsics_received IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'total_transfers_sent' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE total_transfers_sent IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'total_transfers_received' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE total_transfers_received IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'total_value_sent' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE total_value_sent IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'total_value_received' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE total_value_received IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'first_seen_block' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE first_seen_block IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'first_seen_timestamp' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE first_seen_timestamp IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'last_activity_block' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE last_activity_block IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'last_activity_timestamp' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE last_activity_timestamp IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'created_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE created_at IS NOT NULL) UNION ALL
    SELECT 'account_profiles' AS table_name, 'updated_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM account_profiles WHERE updated_at IS NOT NULL) UNION ALL
    -- balance_history
    SELECT 'balance_history' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE id IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'account_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE account_id IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'balance_free' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE balance_free IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'balance_reserved' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE balance_reserved IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'balance_frozen' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE balance_frozen IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'nonce' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE nonce IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'consumers' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE consumers IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'providers' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE providers IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'sufficients' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE sufficients IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'free_change' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE free_change IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'reserved_change' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE reserved_change IS NOT NULL) UNION ALL
    SELECT 'balance_history' AS table_name, 'indexed_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM balance_history WHERE indexed_at IS NOT NULL) UNION ALL
    -- data_submissions
    SELECT 'data_submissions' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE id IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'extrinsic_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE extrinsic_id IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'app_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE app_id IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'submitter_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE submitter_account IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'data_size' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE data_size IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'data_index' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE data_index IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'data_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE data_hash IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'proof_data' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE proof_data IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'submission_fee' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE submission_fee IS NOT NULL) UNION ALL
    SELECT 'data_submissions' AS table_name, 'indexed_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM data_submissions WHERE indexed_at IS NOT NULL) UNION ALL
    -- transfer_events
    SELECT 'transfer_events' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE id IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'extrinsic_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE extrinsic_id IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'event_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE event_id IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'from_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE from_account IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'to_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE to_account IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'amount' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE amount IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'transfer_type' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE transfer_type IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'success' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE success IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'fee_paid' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE fee_paid IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'tip_paid' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE tip_paid IS NOT NULL) UNION ALL
    SELECT 'transfer_events' AS table_name, 'indexed_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM transfer_events WHERE indexed_at IS NOT NULL) UNION ALL
    -- staking_events
    SELECT 'staking_events' AS table_name, 'id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE id IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'block_hash' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE block_hash IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'block_number' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE block_number IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'event_id' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE event_id IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'event_type' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE event_type IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'validator_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE validator_account IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'nominator_account' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE nominator_account IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'amount' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE amount IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'era_index' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE era_index IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'event_data' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE event_data IS NOT NULL) UNION ALL
    SELECT 'staking_events' AS table_name, 'indexed_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM staking_events WHERE indexed_at IS NOT NULL) UNION ALL
    -- schema_migrations
    SELECT 'schema_migrations' AS table_name, 'version' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version IS NOT NULL) UNION ALL
    SELECT 'schema_migrations' AS table_name, 'applied_at' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE applied_at IS NOT NULL) UNION ALL
    SELECT 'schema_migrations' AS table_name, 'description' AS column_name FROM (SELECT 1) AS t WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE description IS NOT NULL)
)
SELECT table_name, array_agg(column_name) as empty_columns
FROM all_empty_columns
GROUP BY table_name;

-- Query to find missing block numbers in block_headers
WITH missing AS (
  SELECT generate_series(min(block_number)::int, max(block_number)::int, 1) AS missing_block
  FROM block_headers
  EXCEPT
  SELECT block_number::int
  FROM block_headers
), groups AS (
  SELECT missing_block, missing_block - ROW_NUMBER() OVER (ORDER BY missing_block) as grp
  FROM missing
)
SELECT
  CASE
    WHEN MIN(missing_block) = MAX(missing_block) THEN MIN(missing_block)::text
    ELSE MIN(missing_block)::text || '-' || MAX(missing_block)::text
  END AS missing_block_range
FROM groups
GROUP BY grp
ORDER BY MIN(missing_block);