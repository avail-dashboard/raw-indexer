-- Apply storage optimization schema changes to existing database
-- Remove redundant fields that duplicate data stored elsewhere

-- 1. Remove balance fields from account_profiles (data exists in balance_history)
ALTER TABLE account_profiles 
DROP COLUMN IF EXISTS current_balance_free,
DROP COLUMN IF EXISTS current_balance_reserved,
DROP COLUMN IF EXISTS current_balance_frozen;

-- 2. Drop extrinsic_events linking table (relationships via event_data.extrinsic_id)
DROP TABLE IF EXISTS extrinsic_events CASCADE;

-- 3. Remove raw data duplication in extrinsic_data
ALTER TABLE extrinsic_data 
DROP COLUMN IF EXISTS signature_data,
DROP COLUMN IF EXISTS era_data;

-- 4. Remove raw data duplication in event_data  
ALTER TABLE event_data 
DROP COLUMN IF EXISTS event_data;

-- Verify changes
\d account_profiles;
\d extrinsic_data;
\d event_data;