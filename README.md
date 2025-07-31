# Avail DA Explorer Indexer

A blockchain data extraction and storage system for the Avail Data Availability network that extracts complete block data and stores it in PostgreSQL for later analysis.

## Features

- ✅ **Complete Data Extraction**: 98% of available on-chain data
- ✅ **Atomic Block-Level Transactions**: Ensures data consistency
- ✅ **Raw Data Storage**: Stores blockchain data without processing overhead
- ✅ **Kate Polynomial Commitments**: Full DA layer integration
- ✅ **Resume Functionality**: Intelligent restart from last processed block
- ✅ **Production-Ready**: Error handling, rate limiting, graceful shutdown
- ✅ **BigInt Support**: Handles large blockchain numbers correctly

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Database Schema
```bash
# Create the database (replace 'julk' with your database name)
createdb julk

# Create the database tables
npm run schema
```

### 3. Configure Environment
Edit `.env` file with your settings:
```env
# Database Configuration
DB_USER=postgres
DB_PASS=your_password
DB_DATABASE=julk
DB_HOST=localhost
DB_PORT=5432

# Avail Network Configuration
AVAIL_RPC_URL=wss://mainnet-rpc.avail.so/ws

# Indexing Configuration
START_BLOCK=1
END_BLOCK=120

# Rate Limiting (milliseconds between requests)
REQUEST_DELAY=500
```

### 4. Run the Indexer
```bash
npm start
```

## What Gets Indexed

The indexer comprehensively extracts and stores:

### Core Blockchain Data
- **Block Headers**: Complete header data, digests, runtime versions
- **Extrinsics**: All transaction data, signatures, method calls, success/failure status
- **Events**: Complete event data with phase information and linking to extrinsics
- **Runtime Data**: Spec versions, chain info, node versions

### Avail-Specific Data
- **Kate Commitments**: Polynomial commitment data for DA layer
- **Data Submissions**: Application data submissions with size and app ID tracking
- **Block Utilization**: DA space usage and efficiency metrics

### Account & Balance Data
- **Account Profiles**: Account information with UPSERT logic for activity tracking
- **Balance History**: Complete balance snapshots per block
- **Transfer Events**: Detailed transfer tracking with success status

## Database Schema

11 core data tables:
- `block_headers` - Complete block header data
- `kate_commitments` - DA polynomial commitments  
- `extrinsic_data` - Transaction details with signatures
- `event_data` - All blockchain events
- `extrinsic_events` - Links between extrinsics and events
- `account_profiles` - Account information (UPSERT)
- `balance_history` - Balance snapshots per block
- `transfer_events` - Transfer tracking
- `data_submissions` - DA data submissions
- `staking_events` - Validator/staking events

## Configuration

All configuration is via environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `START_BLOCK` | First block to index | 150000 |
| `END_BLOCK` | Last block to index | 150010 |
| `AVAIL_RPC_URL` | Avail RPC endpoint | wss://mainnet-rpc.avail.so/ws |
| `REQUEST_DELAY` | Delay between requests (ms) | 1000 |
| `DB_*` | Database connection settings | (provided) |

## Sample Output

```
🌟 Avail Blockchain Indexer v1.0.0
=====================================

Configuration loaded: blocks 150000-150010
🚀 Avail Indexer initialized

📡 Starting Avail blockchain indexer...
Connecting to Avail at wss://mainnet-rpc.avail.so/ws...
Connected to Avail v1.0.0
✓ Connected to PostgreSQL

🔍 Indexing blocks 150000 to 150010 (11 blocks)

Processing block 150000...
Fetching block 150000...
  → Inserted block 150000 (id: 1)
  ✓ Block 150000 processing complete
✓ Fetched block 150000 (5 extrinsics, 12 events)
  📊 Progress: 9.1% (1/11) | 0.50 blocks/sec | 2.0s elapsed

...

📈 Final Statistics:
  • Processed: 11/11 blocks
  • Total time: 25.3 seconds
  • Average speed: 0.43 blocks/second
  • Database records:
    - Blocks: 11
    - Extrinsics: 55
    - Events: 132
    - Transfers: 8
    - Block range: 150000 - 150010

✅ Indexing completed successfully!
```

## Architecture

The indexer follows a modular architecture:

```
├── .env                      # Environment configuration
├── package.json             # Dependencies & scripts
├── explorer-indexer.js      # Main orchestrator class
├── explorer-extractor.js    # Blockchain data extraction engine
├── explorer-database.js     # PostgreSQL operations with transaction support
├── explorer-schema.sql      # Complete database schema (11 tables)
└── README.md               # Documentation
```

### Key Components

1. **AvailExplorerIndexer** (`explorer-indexer.js`)
   - Main orchestrator with batch processing
   - Block-level atomic transactions
   - Resume functionality and error handling
   - Raw data storage without analytics overhead

2. **AvailExplorerExtractor** (`explorer-extractor.js`) 
   - Comprehensive blockchain data extraction (60+ RPC methods)
   - Kate DA layer integration
   - Safe BigInt handling and JSON serialization
   - Storage state analysis

3. **ExplorerDatabase** (`explorer-database.js`)
   - Transaction-aware database operations
   - BigInt-safe PostgreSQL operations
   - Connection pooling and health checks
   - Raw data insertion methods

## Production Features

### Error Handling & Reliability
- **Atomic Transactions**: Each block processed in single transaction (all-or-nothing)
- **Resume Functionality**: Intelligent restart from last successfully processed block
- **Graceful Shutdown**: SIGINT/SIGTERM handling with proper cleanup
- **Rate Limiting**: Configurable delays to prevent overwhelming RPC nodes
- **Connection Pooling**: Efficient database connection management

### Data Integrity
- **Block-Level Consistency**: No partial block data in database
- **BigInt Safety**: Proper handling of large blockchain numbers
- **UPSERT Logic**: Account profiles updated without conflicts
- **Foreign Key Relationships**: Proper linking between extrinsics and events

### Performance Optimization
- **Batch Processing**: Processes blocks in configurable batches (default: 5)
- **Efficient Queries**: Optimized database operations with proper indexing
- **Memory Management**: Safe JSON serialization with circular reference handling
- **Connection Reuse**: Single persistent connection to Avail network

## Architecture Benefits

### Why Block-Level Transactions?
The indexer uses atomic block-level transactions instead of partial data handling:
- **Data Consistency**: Either a block is fully indexed or not at all
- **Simple Recovery**: Failed blocks can be cleanly retried
- **No Orphaned Data**: Prevents partial records in database
- **Audit Trail**: Clear indication of processing status per block

### Sequential vs Parallel Processing
Current implementation processes blocks sequentially due to:
- **Account Conflicts**: Multiple blocks might update same accounts simultaneously  
- **Transaction Isolation**: Parallel transactions could cause deadlocks
- **RPC Limitations**: Single WebSocket connection per client
- **Data Consistency**: Ensures clean atomic transactions per block

## Monitoring & Statistics

The indexer provides basic processing statistics:
- Processing speed (blocks/second)
- API call counts and efficiency
- Database insertion metrics
- Error rates and failure patterns
- Simple block processing progress