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
-- Unused tables removed: app_registrations, staking_events
DROP TABLE IF EXISTS kate_commitments CASCADE;
DROP TABLE IF EXISTS block_headers CASCADE;

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
    is_finalized BOOLEAN DEFAULT FALSE,
    -- timestamp_utc, author_account, finalization_delay_ms removed - never populated
    
    -- Avail-specific header extension (Kate commitments in header)
    application_ids TEXT[], -- Application IDs for DA transaction filtering
    header_extension_version VARCHAR(10),
    
    -- BABE consensus information
    babe_slot NUMERIC(39,0),
    babe_epoch NUMERIC(39,0),
    babe_authority_index INTEGER,
    babe_vrf_output TEXT,
    
    -- Block dimensions for DA matrix
    block_rows INTEGER,
    block_cols INTEGER,
    block_size_bytes INTEGER,
    -- data_root removed - never populated
    
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
    block_length NUMERIC(39,0),
    
    -- Commitment proof data removed - never populated
    -- commitment_hex, data_root, proof_data removed - never populated
    
    -- DA metrics
    utilization_percentage DECIMAL(5,2),
    app_data_count INTEGER DEFAULT 0
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
    -- error_message removed - never populated
    
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
    is_validator BOOLEAN DEFAULT FALSE,
    is_nominator BOOLEAN DEFAULT FALSE,
    -- display_name, identity_judgement removed - never populated
    
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
    last_activity_block NUMERIC(39,0)
    -- first_seen_timestamp, last_activity_timestamp removed - never populated
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

-- Analytics tables removed - storing only raw blockchain data

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Block and hash indexes (optimized for reindexing)
CREATE INDEX idx_block_headers_number_desc ON block_headers(block_number DESC);
CREATE UNIQUE INDEX idx_block_headers_hash_unique ON block_headers(block_hash);
-- Indexes for removed columns commented out
-- CREATE INDEX idx_block_headers_timestamp ON block_headers(timestamp_utc); -- column removed
-- CREATE INDEX idx_block_headers_author ON block_headers(author_account); -- column removed

-- Time-based query optimization
-- CREATE INDEX idx_block_headers_timestamp_number ON block_headers(timestamp_utc, block_number); -- columns removed
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
CREATE INDEX idx_extrinsic_data_signer_block ON extrinsic_data(signer_account, block_number) WHERE signer_account IS NOT NULL;

-- Partial indexes for common filters
CREATE INDEX idx_extrinsic_data_successful ON extrinsic_data(block_number, method_pallet) WHERE success = true;
-- CREATE INDEX idx_extrinsic_data_failed ON extrinsic_data(block_number, error_message) WHERE success = false; -- error_message column removed
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
INCLUDE (current_nonce, last_activity_block, is_validator, is_nominator);
-- last_activity_timestamp removed from INCLUDE - column removed

-- Dynamic date index should be created manually with specific date as needed

CREATE INDEX idx_account_profiles_update_columns
ON account_profiles (current_nonce, last_activity_block);
-- last_activity_timestamp removed - column removed

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

-- App registration indexes removed - app_registrations table not used

-- ================================
-- PERFORMANCE AND MAINTENANCE
-- ================================

-- Materialized views for common queries (optional, can be added later)
-- CREATE MATERIALIZED VIEW daily_network_stats AS ...
-- CREATE MATERIALIZED VIEW validator_performance_summary AS ...
-- CREATE MATERIALIZED VIEW top_accounts_by_activity AS ...

-- Comments for documentation
COMMENT ON TABLE block_headers IS 'Complete block header data with runtime information and statistics';
COMMENT ON TABLE kate_commitments IS 'Avail DA specific Kate polynomial commitment data';
COMMENT ON TABLE extrinsic_data IS 'Comprehensive extrinsic data with execution results';
COMMENT ON TABLE event_data IS 'All blockchain events with relationship mapping';
COMMENT ON TABLE account_profiles IS 'Account profiles with activity statistics';
COMMENT ON TABLE balance_history IS 'Historical balance snapshots per block';
COMMENT ON TABLE data_submissions IS 'Avail DA data submissions tracking';
COMMENT ON TABLE transfer_events IS 'AVAIL token transfer events';
-- Comments for unused tables removed: app_registrations, staking_events
-- Analytics table comments removed

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