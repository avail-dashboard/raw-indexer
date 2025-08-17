-- Database Index Optimization for Avail Explorer Reindexing
-- Optimizes indexes for resume functionality, lookups, and UPSERT operations

-- ================================
-- CRITICAL INDEXES FOR REINDEXING
-- ================================

-- 1. Resume functionality (most critical)
-- Already exists: CREATE INDEX idx_block_headers_number ON block_headers(block_number);
-- But let's ensure it's optimal
DROP INDEX IF EXISTS idx_block_headers_number;
CREATE INDEX idx_block_headers_number_desc ON block_headers(block_number DESC);
COMMENT ON INDEX idx_block_headers_number_desc IS 'Optimized for finding last processed block (DESC for MAX queries)';

-- 2. Block hash lookups (for foreign keys and existence checks)
-- Already exists but let's optimize
DROP INDEX IF EXISTS idx_block_headers_hash;
CREATE UNIQUE INDEX idx_block_headers_hash_unique ON block_headers(block_hash);
COMMENT ON INDEX idx_block_headers_hash_unique IS 'Unique constraint + fast hash lookups';

-- 3. Account ID indexes for UPSERT operations
-- Already exists but let's enhance for bulk operations
DROP INDEX IF EXISTS idx_account_profiles_id;
CREATE UNIQUE INDEX idx_account_profiles_id_unique ON account_profiles(account_id);
COMMENT ON INDEX idx_account_profiles_id_unique IS 'Unique constraint + UPSERT optimization';

-- ================================
-- ENHANCED INDEXES FOR BULK OPERATIONS
-- ================================

-- 4. Composite index for balance history UPSERT
-- Optimizes the unique constraint: UNIQUE(account_id, block_hash)
DROP INDEX IF EXISTS idx_balance_history_account_block;
CREATE UNIQUE INDEX idx_balance_history_account_block_unique ON balance_history(account_id, block_hash);
COMMENT ON INDEX idx_balance_history_account_block_unique IS 'Composite unique index for efficient UPSERT operations';

-- 5. Block number index for balance history (separate for queries)
-- Keep the existing one but ensure it exists
CREATE INDEX IF NOT EXISTS idx_balance_history_block_num ON balance_history(block_number);

-- 6. Extrinsic unique constraint optimization
-- Already has UNIQUE(block_hash, extrinsic_index) but make it an index
DROP INDEX IF EXISTS idx_extrinsic_data_unique;
CREATE UNIQUE INDEX idx_extrinsic_data_block_index_unique ON extrinsic_data(block_hash, extrinsic_index);
COMMENT ON INDEX idx_extrinsic_data_block_index_unique IS 'Prevents duplicate extrinsics + fast lookups';

-- 7. Event unique constraint optimization
DROP INDEX IF EXISTS idx_event_data_unique;
CREATE UNIQUE INDEX idx_event_data_block_index_unique ON event_data(block_hash, event_index);
COMMENT ON INDEX idx_event_data_block_index_unique IS 'Prevents duplicate events + fast lookups';

-- ================================
-- INDEXES FOR FOREIGN KEY PERFORMANCE
-- ================================

-- 8. Foreign key indexes (PostgreSQL doesn't auto-create these)
CREATE INDEX IF NOT EXISTS idx_kate_commitments_block_hash_fk ON kate_commitments(block_hash);
CREATE INDEX IF NOT EXISTS idx_extrinsic_data_block_hash_fk ON extrinsic_data(block_hash);
CREATE INDEX IF NOT EXISTS idx_event_data_block_hash_fk ON event_data(block_hash);
CREATE INDEX IF NOT EXISTS idx_balance_history_block_hash_fk ON balance_history(block_hash);
CREATE INDEX IF NOT EXISTS idx_transfer_events_block_hash_fk ON transfer_events(block_hash);
CREATE INDEX IF NOT EXISTS idx_data_submissions_block_hash_fk ON data_submissions(block_hash);
CREATE INDEX IF NOT EXISTS idx_staking_events_block_hash_fk ON staking_events(block_hash);

-- 9. Account profile foreign key optimization
CREATE INDEX IF NOT EXISTS idx_balance_history_account_fk ON balance_history(account_id);

-- ================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- ================================

-- 10. Partial index for failed extrinsics (much smaller subset)
CREATE INDEX IF NOT EXISTS idx_extrinsic_data_failed ON extrinsic_data(block_number) WHERE success = false;
COMMENT ON INDEX idx_extrinsic_data_failed IS 'Fast queries for failed extrinsics only';

-- 11. Partial index for validator accounts (small subset)
CREATE INDEX IF NOT EXISTS idx_account_profiles_validators ON account_profiles(account_id) WHERE is_validator = true;
COMMENT ON INDEX idx_account_profiles_validators IS 'Fast validator-only queries';

-- 12. Partial index for recent activity (hot data)
CREATE INDEX IF NOT EXISTS idx_balance_history_recent ON balance_history(account_id, block_number) 
WHERE block_number > (SELECT COALESCE(MAX(block_number), 0) - 1000 FROM block_headers);
COMMENT ON INDEX idx_balance_history_recent IS 'Optimized for recent balance queries';

-- ================================
-- INDEXES FOR STATISTICAL QUERIES
-- ================================

-- 13. Method usage statistics
CREATE INDEX IF NOT EXISTS idx_extrinsic_data_method_stats ON extrinsic_data(method_pallet, method_name, block_number);

-- 14. Transfer amount analysis
CREATE INDEX IF NOT EXISTS idx_transfer_events_amount_analysis ON transfer_events(amount, block_number);

-- 15. Data submission app statistics
CREATE INDEX IF NOT EXISTS idx_data_submissions_app_stats ON data_submissions(app_id, block_number);

-- ================================
-- CONCURRENT INDEX CREATION FOR EXISTING DATA
-- ================================

-- 16. If reindexing existing data, use CONCURRENTLY to avoid locks
-- (Only works outside transactions - run separately if needed)
-- CREATE INDEX CONCURRENTLY idx_concurrent_example ON table_name(column);

-- ================================
-- INDEX MONITORING AND MAINTENANCE
-- ================================

-- 17. View to monitor index usage (for optimization)
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

COMMENT ON VIEW index_usage_stats IS 'Monitor which indexes are being used most frequently';

-- 18. View to check index sizes
CREATE OR REPLACE VIEW index_size_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW index_size_stats IS 'Monitor index storage usage';

-- ================================
-- VACUUM AND ANALYZE OPTIMIZATION
-- ================================

-- 19. Update table statistics for optimal query planning
ANALYZE block_headers;
ANALYZE account_profiles;
ANALYZE balance_history;
ANALYZE extrinsic_data;
ANALYZE event_data;
ANALYZE transfer_events;
ANALYZE data_submissions;
ANALYZE kate_commitments;

-- ================================
-- CONFIGURATION RECOMMENDATIONS
-- ================================

-- 20. Recommended PostgreSQL settings for bulk indexing
-- Add these to postgresql.conf and restart PostgreSQL:
/*
-- For bulk reindexing performance:
maintenance_work_mem = 1GB           -- Increase for index creation
work_mem = 256MB                     -- For sorting during index creation
checkpoint_segments = 32             -- Reduce checkpoint frequency
checkpoint_completion_target = 0.9   -- Spread checkpoints
wal_buffers = 16MB                   -- Increase WAL buffer
shared_buffers = 25% of RAM          -- Standard recommendation

-- For connection pooling:
max_connections = 100                -- Adjust based on your needs
*/

-- Success message
SELECT 'Database indexes optimized for reindexing performance!' as status,
       COUNT(*) as total_indexes_created
FROM pg_indexes 
WHERE schemaname = 'public';