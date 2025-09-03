-- Comprehensive Avail DA Explorer Database Schema
-- Covers all explorer functionality excluding logs storage and raw blob content storage
-- Handles BigInt values with NUMERIC(39,0) to prevent data loss
-- Includes optimized indexes for high-performance reindexing and bulk operations

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS transfer_events CASCADE;
DROP TABLE IF EXISTS data_submissions CASCADE;
DROP TABLE IF EXISTS balance_history CASCADE;
DROP TABLE IF EXISTS account_profiles CASCADE;
DROP TABLE IF EXISTS event_data CASCADE;
DROP TABLE IF EXISTS extrinsic_events CASCADE;
DROP TABLE IF EXISTS extrinsic_data CASCADE;
DROP TABLE IF EXISTS network_statistics CASCADE;
DROP TABLE IF EXISTS balances_summary CASCADE;
DROP TABLE IF EXISTS storage_states CASCADE;
DROP TABLE IF EXISTS kate_commitments CASCADE;
DROP TABLE IF EXISTS block_headers CASCADE;
-- Empty/unused tables (kept for completeness)
DROP TABLE IF EXISTS app_registrations CASCADE;
DROP TABLE IF EXISTS staking_events CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- ================================
-- CORE BLOCKCHAIN DATA
-- ================================

-- Block Headers with complete metadata
CREATE TABLE block_headers (
    id SERIAL PRIMARY KEY,
    block_number NUMERIC(39,0) NOT NULL UNIQUE,
    block_hash VARCHAR(66) NOT NULL UNIQUE,
    parent_hash VARCHAR(66) NOT NULL,
    state_root VARCHAR(66) NOT NULL,
    extrinsics_root VARCHAR(66) NOT NULL,
    
    -- Timing and validation
    timestamp_utc TIMESTAMP,
    author_account VARCHAR(256),
    is_finalized BOOLEAN DEFAULT FALSE,
    finalization_delay_ms INTEGER,
    -- Note: timestamp_utc, author_account, finalization_delay_ms are inserted by code but currently always NULL
    -- Note: Avail DA-specific columns (application_ids, babe_*, block_*) do NOT exist in actual database
    
    -- Block statistics
    extrinsics_count INTEGER DEFAULT 0,
    events_count INTEGER DEFAULT 0,
    data_submissions_count INTEGER DEFAULT 0,
    total_fees NUMERIC(39,0) DEFAULT 0,
    total_tips NUMERIC(39,0) DEFAULT 0,
    
    -- Runtime information
    spec_version NUMERIC(39,0),
    impl_version NUMERIC(39,0),
    authoring_version NUMERIC(39,0),
    transaction_version NUMERIC(39,0),
    state_version NUMERIC(39,0),
    
    -- Runtime metadata (populated by code)
    spec_name VARCHAR(50),
    impl_name VARCHAR(50),
    chain_name VARCHAR(100),
    node_version VARCHAR(50),
    chain_properties JSONB,
    
    -- Raw data for reconstruction
    digest_json JSONB,
    header_raw_hex TEXT,
    
    -- Indexing metadata
    extraction_version VARCHAR(10) DEFAULT '2.0.0'
);

-- Kate Polynomial Commitments (Avail DA specific)
CREATE TABLE kate_commitments (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL,
    block_number NUMERIC(39,0) NOT NULL,
    
    -- Kate commitment data
    rows INTEGER,
    cols INTEGER,
    data_root VARCHAR(66), -- Inserted by code but currently always NULL
    block_length NUMERIC(39,0),
    
    -- Commitment proof data
    commitment_hex TEXT, -- Inserted by code but currently always NULL
    proof_data JSONB,
    
    -- DA metrics
    utilization_percentage DECIMAL(5,2),
    app_data_count INTEGER DEFAULT 0,
    
    -- Sampling and extraction data (ACTIVELY POPULATED)
    sample_data_proof JSONB, -- 1 record populated
    sample_row_data JSONB, -- 209,635 records populated
    kate_available BOOLEAN DEFAULT TRUE, -- All 1.8M records populated
    kate_extraction_note TEXT -- Inserted by code but currently always NULL
);

-- Application Registrations table removed - not being populated

-- ================================
-- TRANSACTION AND EXTRINSIC DATA
-- ================================

-- Comprehensive Extrinsic Data
CREATE TABLE extrinsic_data (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL,
    block_number NUMERIC(39,0) NOT NULL,
    extrinsic_index INTEGER NOT NULL,
    extrinsic_hash VARCHAR(66) NOT NULL,
    
    -- Extrinsic metadata
    is_signed BOOLEAN NOT NULL,
    signer_account VARCHAR(256),
    method_pallet VARCHAR(50) NOT NULL,
    method_name VARCHAR(50) NOT NULL,
    
    -- Transaction details
    nonce NUMERIC(39,0),
    tip NUMERIC(39,0) DEFAULT 0,
    fee NUMERIC(39,0) DEFAULT 0,
    
    -- Execution results
    success BOOLEAN,
    error_message TEXT,
    -- Note: error_message is inserted by code but currently always NULL
    
    -- Data and signatures  
    method_args JSONB,
    -- signature_data, era_data removed: parse from raw_hex when needed
    
    -- Raw data for reconstruction
    raw_hex TEXT,
    length_bytes INTEGER,
    
    UNIQUE(block_hash, extrinsic_index)
);

-- Events within extrinsics and blocks
CREATE TABLE event_data (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL,
    block_number NUMERIC(39,0) NOT NULL,
    event_index INTEGER NOT NULL,
    
    -- Event location
    extrinsic_id INTEGER,
    extrinsic_index INTEGER,
    phase_type VARCHAR(20), -- 'ApplyExtrinsic', 'Finalization', 'Initialization'
    phase_value INTEGER,
    
    -- Event details
    pallet VARCHAR(50) NOT NULL,
    event_name VARCHAR(50) NOT NULL,
    -- event_data removed: parse from raw_data when needed  
    topics TEXT[],
    
    -- Event raw data
    raw_data JSONB,
    
    UNIQUE(block_hash, event_index)
);

-- Extrinsic-event linking removed: use event_data.extrinsic_id foreign key

-- ================================
-- ACCOUNT AND BALANCE MANAGEMENT
-- ================================

-- Account Profiles with metadata
CREATE TABLE account_profiles (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(256) NOT NULL UNIQUE,
    
    -- Account metadata
    display_name VARCHAR(100),
    identity_judgement VARCHAR(20),
    is_validator BOOLEAN DEFAULT FALSE,
    is_nominator BOOLEAN DEFAULT FALSE,
    -- Note: display_name, identity_judgement are inserted by code but currently always NULL
    
    -- Current state (updated per block)
    current_nonce NUMERIC(39,0) DEFAULT 0,
    
    -- Statistics
    total_extrinsics_sent INTEGER DEFAULT 0,
    total_extrinsics_received INTEGER DEFAULT 0,
    total_transfers_sent INTEGER DEFAULT 0,
    total_transfers_received INTEGER DEFAULT 0,
    total_value_sent NUMERIC(39,0) DEFAULT 0,
    total_value_received NUMERIC(39,0) DEFAULT 0,
    
    -- Activity tracking
    first_seen_block NUMERIC(39,0),
    first_seen_timestamp TIMESTAMP,
    last_activity_block NUMERIC(39,0),
    last_activity_timestamp TIMESTAMP
    -- Note: first_seen_timestamp, last_activity_timestamp are inserted by code but currently always NULL
);

-- Balance History (snapshots per block)
CREATE TABLE balance_history (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(256) NOT NULL,
    block_hash VARCHAR(66) NOT NULL,
    block_number NUMERIC(39,0) NOT NULL,
    
    -- Balance snapshot
    balance_free NUMERIC(39,0) NOT NULL,
    balance_reserved NUMERIC(39,0) NOT NULL,
    balance_frozen NUMERIC(39,0) DEFAULT 0,
    
    -- Account state
    nonce NUMERIC(39,0) NOT NULL,
    consumers NUMERIC(39,0) DEFAULT 0,
    providers NUMERIC(39,0) DEFAULT 0,
    sufficients NUMERIC(39,0) DEFAULT 0,
    
    -- Change tracking
    free_change NUMERIC(39,0) DEFAULT 0,
    reserved_change NUMERIC(39,0) DEFAULT 0,
    
    UNIQUE(account_id, block_hash)
);

-- ================================
-- DATA SUBMISSIONS AND TRANSFERS
-- ================================

-- Data Submissions (Avail DA specific)
CREATE TABLE data_submissions (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL,
    block_number NUMERIC(39,0) NOT NULL,
    extrinsic_id INTEGER,
    
    -- Submission details
    app_id NUMERIC(39,0) NOT NULL,
    submitter_account VARCHAR(256) NOT NULL,
    data_size INTEGER NOT NULL,
    
    -- DA specific data removed - never populated
    -- data_index, data_hash, proof_data removed - never populated
    
    -- Fee information
    submission_fee NUMERIC(39,0) DEFAULT 0
);

-- AVAIL Transfer Events
CREATE TABLE transfer_events (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL,
    block_number NUMERIC(39,0) NOT NULL,
    event_id INTEGER,
    -- extrinsic_id removed - never populated
    
    -- Transfer details
    from_account VARCHAR(256) NOT NULL,
    to_account VARCHAR(256) NOT NULL,
    amount NUMERIC(39,0) NOT NULL,
    
    -- Transfer metadata
    transfer_type VARCHAR(20) DEFAULT 'Transfer', -- Transfer, Reserve, Unreserve, etc.
    success BOOLEAN DEFAULT TRUE,
    
    -- Fee information
    fee_paid NUMERIC(39,0) DEFAULT 0,
    tip_paid NUMERIC(39,0) DEFAULT 0
);

-- ================================
-- STAKING AND VALIDATION DATA
-- ================================

-- Staking Events table removed - not being populated

-- ================================
-- NETWORK ANALYTICS AND STATISTICS
-- ================================

-- Network Statistics (Per-block network metrics)
CREATE TABLE network_statistics (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number NUMERIC(39,0) NOT NULL,
    
    -- Block statistics
    extrinsics_count INTEGER,
    events_count INTEGER,
    signed_extrinsics_count INTEGER,
    unsigned_extrinsics_count INTEGER,
    
    -- Fee and tip statistics
    total_tips NUMERIC(39,0) DEFAULT 0,
    total_fees NUMERIC(39,0) DEFAULT 0,
    average_tip NUMERIC(39,0) DEFAULT 0,
    average_fee NUMERIC(39,0) DEFAULT 0,
    
    -- DA statistics
    da_submissions_count INTEGER DEFAULT 0,
    da_total_data_size NUMERIC(39,0) DEFAULT 0,
    da_unique_apps_count INTEGER DEFAULT 0,
    
    -- Account statistics
    total_accounts_count INTEGER DEFAULT 0,
    active_accounts_count INTEGER DEFAULT 0,
    
    -- Indexing metadata
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Balance Summary (Per-block balance aggregations)
CREATE TABLE balances_summary (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number NUMERIC(39,0) NOT NULL,
    
    -- Total supply and balance statistics
    total_issuance NUMERIC(39,0) NOT NULL,
    total_balance_accounts INTEGER DEFAULT 0,
    total_free_balance NUMERIC(39,0) DEFAULT 0,
    total_reserved_balance NUMERIC(39,0) DEFAULT 0,
    total_frozen_balance NUMERIC(39,0) DEFAULT 0,
    
    -- Processing metadata
    balance_pages_loaded INTEGER DEFAULT 0,
    balance_extraction_note TEXT,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Storage States (Per-block runtime storage snapshots)
CREATE TABLE storage_states (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number NUMERIC(39,0) NOT NULL,
    
    -- Runtime storage data
    system_data JSONB,
    balances_data JSONB,
    total_issuance NUMERIC(39,0),
    
    -- DA app data
    da_next_app_id NUMERIC(39,0),
    da_app_keys JSONB,
    da_data_submissions JSONB,
    
    -- Validator/session data
    session_validators JSONB,
    session_validator_count INTEGER,
    staking_current_era NUMERIC(39,0),
    
    -- Processing metadata
    storage_extraction_note TEXT,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Block and hash indexes (optimized for reindexing)
CREATE INDEX idx_block_headers_number_desc ON block_headers(block_number DESC);
CREATE UNIQUE INDEX idx_block_headers_hash_unique ON block_headers(block_hash);
CREATE INDEX idx_block_headers_timestamp ON block_headers(timestamp_utc);
CREATE INDEX idx_block_headers_author ON block_headers(author_account);

-- Time-based query optimization
CREATE INDEX idx_block_headers_timestamp_number ON block_headers(timestamp_utc, block_number);
-- Dynamic date indexes should be created manually with specific dates as needed

-- Block Processing Performance Optimization
CREATE INDEX idx_block_headers_hash_lookup
ON block_headers (block_hash, block_number);

-- Extrinsic indexes
CREATE INDEX idx_extrinsic_data_block ON extrinsic_data(block_number);
CREATE INDEX idx_extrinsic_data_hash ON extrinsic_data(block_hash);
CREATE INDEX idx_extrinsic_data_signer ON extrinsic_data(signer_account);
CREATE INDEX idx_extrinsic_data_method ON extrinsic_data(method_pallet, method_name);
CREATE INDEX idx_extrinsic_data_success ON extrinsic_data(success);

-- Composite indexes for common query patterns
CREATE INDEX idx_extrinsic_data_block_index ON extrinsic_data(block_number, extrinsic_index);
CREATE INDEX idx_extrinsic_data_method_lookup ON extrinsic_data(method_pallet, method_name, extrinsic_index, block_number);
CREATE INDEX idx_extrinsic_data_signer_block ON extrinsic_data(signer_account, block_number) WHERE signer_account IS NOT NULL;

-- Partial indexes for common filters
CREATE INDEX idx_extrinsic_data_successful ON extrinsic_data(block_number, method_pallet) WHERE success = true;
CREATE INDEX idx_extrinsic_data_failed ON extrinsic_data(block_number, error_message) WHERE success = false;
CREATE INDEX idx_extrinsic_data_signed ON extrinsic_data(signer_account, block_number) WHERE is_signed = true;

-- Event indexes
CREATE INDEX idx_event_data_block ON event_data(block_number);
CREATE INDEX idx_event_data_extrinsic ON event_data(extrinsic_id);
CREATE INDEX idx_event_data_pallet ON event_data(pallet, event_name);

-- Event Performance Optimization
CREATE INDEX idx_event_data_extrinsic_lookup
ON event_data (extrinsic_id, block_number) 
WHERE extrinsic_id IS NOT NULL;

CREATE INDEX idx_event_data_block_processing
ON event_data (block_hash, event_index);

-- Composite indexes for event lookups
CREATE INDEX idx_event_data_block_index ON event_data(block_number, event_index);
CREATE INDEX idx_event_data_pallet_block ON event_data(pallet, block_number);

-- Account indexes (optimized for UPSERT operations)
CREATE UNIQUE INDEX idx_account_profiles_id_unique ON account_profiles(account_id);
CREATE INDEX idx_account_profiles_validator ON account_profiles(is_validator);
CREATE INDEX idx_account_profiles_activity ON account_profiles(last_activity_block);

-- ================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ================================

-- CRITICAL: Account Profiles UPSERT Optimization
CREATE INDEX idx_account_profiles_fast_update 
ON account_profiles (account_id) 
INCLUDE (current_nonce, last_activity_block, last_activity_timestamp, is_validator, is_nominator);

-- Dynamic date index should be created manually with specific date as needed

CREATE INDEX idx_account_profiles_update_columns
ON account_profiles (current_nonce, last_activity_block, last_activity_timestamp);

-- Account activity partial indexes
-- Dynamic date indexes should be created manually with specific dates as needed

CREATE INDEX idx_account_profiles_high_activity ON account_profiles(total_extrinsics_sent DESC, account_id) 
WHERE total_extrinsics_sent > 100;

-- Balance history indexes (optimized for bulk operations)
CREATE INDEX idx_balance_history_account ON balance_history(account_id);
CREATE INDEX idx_balance_history_block ON balance_history(block_number);
CREATE UNIQUE INDEX idx_balance_history_account_block_unique ON balance_history(account_id, block_hash);

-- Balance History Performance Optimization
CREATE INDEX idx_balance_history_insert_fast
ON balance_history (account_id, block_number) 
INCLUDE (balance_free, balance_reserved, balance_frozen);

-- Transfer indexes
CREATE INDEX idx_transfer_events_from ON transfer_events(from_account);
CREATE INDEX idx_transfer_events_to ON transfer_events(to_account);
CREATE INDEX idx_transfer_events_block ON transfer_events(block_number);
CREATE INDEX idx_transfer_events_amount ON transfer_events(amount);

-- Transfer relationship indexes
CREATE INDEX idx_transfer_events_from_block ON transfer_events(from_account, block_number);
CREATE INDEX idx_transfer_events_to_block ON transfer_events(to_account, block_number);
CREATE INDEX idx_transfer_events_amount_block ON transfer_events(amount DESC, block_number) WHERE amount > 0;

-- Data submission indexes
CREATE INDEX idx_data_submissions_app ON data_submissions(app_id);
CREATE INDEX idx_data_submissions_submitter ON data_submissions(submitter_account);
CREATE INDEX idx_data_submissions_block ON data_submissions(block_number);

-- Cross-table relationship indexes
CREATE INDEX idx_data_submissions_app_block ON data_submissions(app_id, block_number);
CREATE INDEX idx_data_submissions_submitter_app ON data_submissions(submitter_account, app_id);

-- Analytics indexes removed

-- Staking indexes removed - staking_events table not used

-- Kate commitment indexes
CREATE INDEX idx_kate_commitments_block ON kate_commitments(block_number);
CREATE INDEX idx_kate_commitments_hash ON kate_commitments(block_hash);

-- Network statistics indexes
CREATE INDEX idx_network_statistics_block_number ON network_statistics(block_number);
CREATE INDEX idx_network_statistics_block_hash ON network_statistics(block_hash);
CREATE INDEX idx_network_statistics_timeseries ON network_statistics(block_number, indexed_at) 
    INCLUDE (extrinsics_count, events_count, total_accounts_count);

-- Balance summary indexes
CREATE INDEX idx_balances_summary_block_number ON balances_summary(block_number);
CREATE INDEX idx_balances_summary_block_hash ON balances_summary(block_hash);

-- Storage states indexes
CREATE INDEX idx_storage_states_block_number ON storage_states(block_number);
CREATE INDEX idx_storage_states_block_hash ON storage_states(block_hash);
CREATE INDEX idx_storage_states_block_lookup ON storage_states(block_number, indexed_at);

-- App registration indexes removed - app_registrations table not used

-- ================================
-- PERFORMANCE AND MAINTENANCE
-- ================================

-- Materialized views for common queries (optional, can be added later)
-- CREATE MATERIALIZED VIEW daily_network_stats AS ...
-- CREATE MATERIALIZED VIEW validator_performance_summary AS ...
-- CREATE MATERIALIZED VIEW top_accounts_by_activity AS ...

-- Comments for documentation
COMMENT ON TABLE block_headers IS 'Complete block header data with runtime information and statistics (1.8M rows)';
COMMENT ON TABLE kate_commitments IS 'Avail DA specific Kate polynomial commitment data with sampling (1.8M rows)';
COMMENT ON TABLE extrinsic_data IS 'Comprehensive extrinsic data with execution results (4.5M rows)';
COMMENT ON TABLE event_data IS 'All blockchain events with relationship mapping (15.4M rows)';
COMMENT ON TABLE account_profiles IS 'Account profiles with activity statistics (284K rows)';
COMMENT ON TABLE balance_history IS 'Historical balance snapshots per block (1.2M rows)';
COMMENT ON TABLE data_submissions IS 'Avail DA data submissions tracking (324K rows)';
COMMENT ON TABLE transfer_events IS 'AVAIL token transfer events (668K rows)';
COMMENT ON TABLE network_statistics IS 'Per-block network metrics and statistics (1.7M rows)';
COMMENT ON TABLE balances_summary IS 'Per-block balance aggregations and total supply data (1.8M rows)';
COMMENT ON TABLE storage_states IS 'Per-block runtime storage state snapshots (1.7M rows)';
-- Note: app_registrations and staking_events exist but are empty (0 rows each)

COMMENT ON COLUMN block_headers.block_number IS 'Block number as NUMERIC(39,0) to handle BigInt values';
COMMENT ON COLUMN extrinsic_data.tip IS 'Transaction tip in AVAIL base units (plancks)';
COMMENT ON COLUMN balance_history.balance_free IS 'Free balance in AVAIL base units (plancks)';
COMMENT ON COLUMN transfer_events.amount IS 'Transfer amount in AVAIL base units (plancks)';

-- Schema version tracking
CREATE TABLE schema_migrations (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES 
('2.0.0', 'Comprehensive Avail DA Explorer schema with BigInt support');

-- Success message
SELECT 'Avail DA Explorer database schema created successfully!' as status;