-- Avail Blockchain PostgreSQL Schema
-- Based on introspectionSchema.json analysis

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS transfer_entities CASCADE;
DROP TABLE IF EXISTS account_entities CASCADE;
DROP TABLE IF EXISTS data_submissions CASCADE;
DROP TABLE IF EXISTS commitments CASCADE;
DROP TABLE IF EXISTS app_lookups CASCADE;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS extrinsics CASCADE;
DROP TABLE IF EXISTS header_extensions CASCADE;
DROP TABLE IF EXISTS spec_versions CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS accoun_to_update_values CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;

-- Core blocks table - foundation of blockchain data
CREATE TABLE blocks (
    id BIGSERIAL PRIMARY KEY,
    hash VARCHAR(66) UNIQUE NOT NULL,
    number BIGINT UNIQUE NOT NULL,
    parent_hash VARCHAR(66) NOT NULL,
    state_root VARCHAR(66) NOT NULL,
    extrinsics_root VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    author VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Avail-specific header extensions for DA commitments
CREATE TABLE header_extensions (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    hash VARCHAR(66) UNIQUE NOT NULL,
    commitment_data JSONB,
    app_lookup_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Runtime specification versions
CREATE TABLE spec_versions (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    spec_version INTEGER NOT NULL,
    impl_version INTEGER NOT NULL,
    impl_name VARCHAR(255),
    authoring_version INTEGER,
    transaction_version INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Validator sessions
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    session_index INTEGER NOT NULL,
    validators JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account update tracking
CREATE TABLE accoun_to_update_values (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    account_id VARCHAR(66) NOT NULL,
    update_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blockchain transactions/calls
CREATE TABLE extrinsics (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    hash VARCHAR(66) UNIQUE NOT NULL,
    index INTEGER NOT NULL,
    version INTEGER NOT NULL,
    signature JSONB,
    method VARCHAR(255) NOT NULL,
    section VARCHAR(255) NOT NULL,
    args JSONB,
    tip NUMERIC(39,0) DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    error JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(block_id, index)
);

-- Events emitted during execution
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    extrinsic_id BIGINT REFERENCES extrinsics(id) ON DELETE CASCADE,
    index INTEGER NOT NULL,
    phase VARCHAR(50) NOT NULL,
    method VARCHAR(255) NOT NULL,
    section VARCHAR(255) NOT NULL,
    data JSONB,
    topics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(block_id, index)
);

-- System logs and messages
CREATE TABLE logs (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    log_type VARCHAR(50) NOT NULL,
    engine VARCHAR(255),
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Avail application lookups for DA
CREATE TABLE app_lookups (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    header_extension_id BIGINT NOT NULL REFERENCES header_extensions(id) ON DELETE CASCADE,
    app_id INTEGER NOT NULL,
    size INTEGER NOT NULL,
    index_value INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data availability commitments
CREATE TABLE commitments (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    header_extension_id BIGINT NOT NULL REFERENCES header_extensions(id) ON DELETE CASCADE,
    commitment VARCHAR(255) NOT NULL,
    length INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data submissions to DA layer
CREATE TABLE data_submissions (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    extrinsic_id BIGINT REFERENCES extrinsics(id) ON DELETE CASCADE,
    app_id INTEGER NOT NULL,
    data_length INTEGER NOT NULL,
    data_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account states and balances
CREATE TABLE account_entities (
    id VARCHAR(66) PRIMARY KEY, -- Account address as primary key
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    nonce INTEGER DEFAULT 0,
    balance NUMERIC(39,0) DEFAULT 0, -- Support up to 39 digits for large balances
    reserved NUMERIC(39,0) DEFAULT 0,
    frozen NUMERIC(39,0) DEFAULT 0,
    last_updated_block BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Balance transfer tracking
CREATE TABLE transfer_entities (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    extrinsic_id BIGINT REFERENCES extrinsics(id) ON DELETE CASCADE,
    event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
    from_account VARCHAR(66) NOT NULL,
    to_account VARCHAR(66) NOT NULL,
    amount NUMERIC(39,0) NOT NULL, -- Support large transfer amounts
    fee NUMERIC(39,0) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_blocks_number ON blocks(number);
CREATE INDEX idx_blocks_hash ON blocks(hash);
CREATE INDEX idx_blocks_timestamp ON blocks(timestamp);

CREATE INDEX idx_extrinsics_block_id ON extrinsics(block_id);
CREATE INDEX idx_extrinsics_method_section ON extrinsics(method, section);
CREATE INDEX idx_extrinsics_success ON extrinsics(success);
CREATE INDEX idx_extrinsics_hash ON extrinsics(hash);

CREATE INDEX idx_events_block_id ON events(block_id);
CREATE INDEX idx_events_extrinsic_id ON events(extrinsic_id);
CREATE INDEX idx_events_method_section ON events(method, section);
CREATE INDEX idx_events_phase ON events(phase);

CREATE INDEX idx_account_entities_balance ON account_entities(balance);
CREATE INDEX idx_account_entities_last_updated ON account_entities(last_updated_block);

CREATE INDEX idx_transfer_entities_from ON transfer_entities(from_account);
CREATE INDEX idx_transfer_entities_to ON transfer_entities(to_account);
CREATE INDEX idx_transfer_entities_block_id ON transfer_entities(block_id);
CREATE INDEX idx_transfer_entities_amount ON transfer_entities(amount);

CREATE INDEX idx_header_extensions_block_id ON header_extensions(block_id);
CREATE INDEX idx_app_lookups_app_id ON app_lookups(app_id);
CREATE INDEX idx_commitments_block_id ON commitments(block_id);
CREATE INDEX idx_data_submissions_app_id ON data_submissions(app_id);

-- GIN indexes for JSONB fields
CREATE INDEX idx_extrinsics_args_gin ON extrinsics USING GIN(args);
CREATE INDEX idx_events_data_gin ON events USING GIN(data);
CREATE INDEX idx_header_extensions_commitment_gin ON header_extensions USING GIN(commitment_data);

-- Comments for documentation
COMMENT ON TABLE blocks IS 'Core blockchain blocks with header information';
COMMENT ON TABLE header_extensions IS 'Avail-specific header extensions containing DA commitment data';
COMMENT ON TABLE extrinsics IS 'Blockchain transactions and calls';
COMMENT ON TABLE events IS 'Events emitted during block execution';
COMMENT ON TABLE account_entities IS 'Account states and balances (using account address as PK)';
COMMENT ON TABLE transfer_entities IS 'Balance transfer tracking between accounts';
COMMENT ON TABLE app_lookups IS 'Avail application lookups for data availability';
COMMENT ON TABLE commitments IS 'Data availability commitments';
COMMENT ON TABLE data_submissions IS 'Data submissions to Avail DA layer';

COMMENT ON COLUMN blocks.hash IS 'Block hash (0x + 64 hex chars)';
COMMENT ON COLUMN blocks.number IS 'Sequential block number';
COMMENT ON COLUMN extrinsics.success IS 'Whether the extrinsic executed successfully';
COMMENT ON COLUMN account_entities.id IS 'Account address (SS58 format)';
COMMENT ON COLUMN transfer_entities.amount IS 'Transfer amount in smallest unit';

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_indexer_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_indexer_user;