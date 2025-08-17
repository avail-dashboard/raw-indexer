-- Add Missing Blockchain Data Storage
-- This script adds all missing fields and tables to store complete blockchain data

-- ================================
-- 1. ADD MISSING RUNTIME DATA TO BLOCK_HEADERS
-- ================================

-- Add missing runtime fields to block_headers
ALTER TABLE block_headers ADD COLUMN IF NOT EXISTS spec_name VARCHAR(50);
ALTER TABLE block_headers ADD COLUMN IF NOT EXISTS impl_name VARCHAR(50);  
ALTER TABLE block_headers ADD COLUMN IF NOT EXISTS chain_name VARCHAR(100);
ALTER TABLE block_headers ADD COLUMN IF NOT EXISTS node_version VARCHAR(50);
ALTER TABLE block_headers ADD COLUMN IF NOT EXISTS chain_properties JSONB;

-- Re-enable digest storage (currently skipped)
ALTER TABLE block_headers ALTER COLUMN digest_json DROP DEFAULT;

-- ================================
-- 2. CREATE STORAGE_STATES TABLE
-- ================================

CREATE TABLE IF NOT EXISTS storage_states (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL REFERENCES block_headers(block_hash),
    block_number NUMERIC(39,0) NOT NULL,
    
    -- System storage state
    system_data JSONB,
    
    -- Balances storage state  
    balances_data JSONB,
    total_issuance NUMERIC(39,0),
    
    -- Data Availability storage state
    da_next_app_id NUMERIC(39,0),
    da_app_keys JSONB,
    da_data_submissions JSONB,
    
    -- Session storage state
    session_validators JSONB,
    session_validator_count INTEGER,
    
    -- Staking storage state  
    staking_current_era NUMERIC(39,0),
    
    -- Storage extraction metadata
    storage_extraction_note TEXT,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(block_hash)
);

-- ================================
-- 3. CREATE NETWORK_STATISTICS TABLE  
-- ================================

CREATE TABLE IF NOT EXISTS network_statistics (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL REFERENCES block_headers(block_hash),
    block_number NUMERIC(39,0) NOT NULL,
    
    -- Block statistics
    extrinsics_count INTEGER,
    events_count INTEGER, 
    signed_extrinsics_count INTEGER,
    unsigned_extrinsics_count INTEGER,
    
    -- Fee statistics
    total_tips NUMERIC(39,0) DEFAULT 0,
    total_fees NUMERIC(39,0) DEFAULT 0,
    average_tip NUMERIC(39,0) DEFAULT 0,
    average_fee NUMERIC(39,0) DEFAULT 0,
    
    -- Data Availability statistics
    da_submissions_count INTEGER DEFAULT 0,
    da_total_data_size NUMERIC(39,0) DEFAULT 0,
    da_unique_apps_count INTEGER DEFAULT 0,
    
    -- Account statistics
    total_accounts_count INTEGER DEFAULT 0,
    active_accounts_count INTEGER DEFAULT 0,
    
    -- Network metadata
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(block_hash)
);

-- ================================
-- 4. ENHANCE KATE_COMMITMENTS TABLE
-- ================================

-- Add missing Kate commitment fields
ALTER TABLE kate_commitments ADD COLUMN IF NOT EXISTS sample_data_proof JSONB;
ALTER TABLE kate_commitments ADD COLUMN IF NOT EXISTS sample_row_data JSONB;
ALTER TABLE kate_commitments ADD COLUMN IF NOT EXISTS kate_available BOOLEAN DEFAULT TRUE;
ALTER TABLE kate_commitments ADD COLUMN IF NOT EXISTS kate_extraction_note TEXT;

-- ================================
-- 5. CREATE BALANCES_SUMMARY TABLE
-- ================================

CREATE TABLE IF NOT EXISTS balances_summary (
    id SERIAL PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL REFERENCES block_headers(block_hash),
    block_number NUMERIC(39,0) NOT NULL,
    
    -- Total issuance and supply metrics
    total_issuance NUMERIC(39,0) NOT NULL,
    
    -- Balance distribution metrics (if calculated)
    total_balance_accounts INTEGER DEFAULT 0,
    total_free_balance NUMERIC(39,0) DEFAULT 0,
    total_reserved_balance NUMERIC(39,0) DEFAULT 0,
    total_frozen_balance NUMERIC(39,0) DEFAULT 0,
    
    -- Balance extraction metadata
    balance_pages_loaded INTEGER DEFAULT 0,
    balance_extraction_note TEXT,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(block_hash)
);

-- ================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ================================

-- Storage states indexes
CREATE INDEX IF NOT EXISTS idx_storage_states_block_number ON storage_states(block_number);
CREATE INDEX IF NOT EXISTS idx_storage_states_block_hash ON storage_states(block_hash);

-- Network statistics indexes  
CREATE INDEX IF NOT EXISTS idx_network_statistics_block_number ON network_statistics(block_number);
CREATE INDEX IF NOT EXISTS idx_network_statistics_block_hash ON network_statistics(block_hash);

-- Balances summary indexes
CREATE INDEX IF NOT EXISTS idx_balances_summary_block_number ON balances_summary(block_number);
CREATE INDEX IF NOT EXISTS idx_balances_summary_block_hash ON balances_summary(block_hash);

-- Enhanced kate commitments indexes
CREATE INDEX IF NOT EXISTS idx_kate_commitments_available ON kate_commitments(kate_available);

-- ================================
-- 7. ADD COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE storage_states IS 'Complete blockchain storage state data per block';
COMMENT ON TABLE network_statistics IS 'Network-wide statistics and metrics per block';
COMMENT ON TABLE balances_summary IS 'Token balances and issuance summary per block';

COMMENT ON COLUMN block_headers.spec_name IS 'Runtime specification name (e.g., avail)';
COMMENT ON COLUMN block_headers.impl_name IS 'Implementation name (e.g., avail-node)';
COMMENT ON COLUMN block_headers.chain_name IS 'Chain identifier (e.g., Avail Mainnet)';
COMMENT ON COLUMN block_headers.node_version IS 'Node version string (e.g., 1.8.0-1b86d73c8)';
COMMENT ON COLUMN block_headers.chain_properties IS 'Chain properties (token symbol, decimals, etc.)';

COMMENT ON COLUMN storage_states.total_issuance IS 'Total token issuance at this block';
COMMENT ON COLUMN network_statistics.da_submissions_count IS 'Number of data availability submissions';
COMMENT ON COLUMN kate_commitments.sample_data_proof IS 'Sample data proof from Kate commitment';

-- Success message
SELECT 'All missing blockchain data storage tables and columns added successfully!' as status;