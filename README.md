# Avail Blockchain Indexer

A proof-of-concept indexer that fetches data from the Avail blockchain and stores it in PostgreSQL.

## Features

- ✅ Configurable via environment variables (no hardcoded values)
- ✅ Fetches blocks, extrinsics, events from Avail mainnet
- ✅ Comprehensive PostgreSQL schema based on introspectionSchema.json
- ✅ Rate limiting and retry logic for RPC calls
- ✅ Graceful error handling and progress tracking
- ✅ Transaction-based database insertions with conflict resolution

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Database Schema
```bash
# Create the database tables
npm run schema
```

### 3. Configure Environment
Edit `.env` file with your settings:
```env
# Database (already configured)
DB_USER=postgres
DB_PASS=liquidGlass
DB_DATABASE=Sakshi
DB_HOST=localhost
DB_PORT=5432

# Blocks to index (currently set to 150000-150010)
START_BLOCK=150000
END_BLOCK=150010

# Rate limiting (1 second between requests)
REQUEST_DELAY=1000
```

### 4. Run the Indexer
```bash
npm start
```

## What Gets Indexed

The indexer fetches and stores:

- **Blocks**: Hash, number, timestamp, author, etc.
- **Extrinsics**: Transactions with method, args, signatures
- **Events**: All events emitted during execution
- **Transfers**: Balance transfers between accounts
- **Sessions**: Validator session information
- **Spec Versions**: Runtime version tracking

## Database Schema

Tables created:
- `blocks` - Core blockchain blocks
- `extrinsics` - Transactions/calls
- `events` - Events emitted
- `transfer_entities` - Balance transfers
- `account_entities` - Account states
- `sessions` - Validator sessions
- `spec_versions` - Runtime versions
- `header_extensions` - Avail DA commitments
- `app_lookups` - DA application lookups
- `commitments` - DA commitments
- `data_submissions` - DA data submissions
- `logs` - System logs

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

## Files Structure

```
├── .env                   # Configuration
├── package.json          # Dependencies
├── config.js             # Configuration loader
├── schema.sql            # Database schema
├── avail-client.js       # Blockchain connection
├── database.js           # PostgreSQL operations
├── index.js              # Main indexer script
└── README.md             # This file
```

## Error Handling

- **Connection failures**: Automatic retry with exponential backoff
- **Rate limiting**: Configurable delays between requests
- **Database conflicts**: ON CONFLICT DO UPDATE for idempotency
- **Graceful shutdown**: CTRL+C handling with cleanup

## Limitations (Hackathon Version)

- Sequential block processing (not parallel)
- Basic retry logic (no exponential backoff)
- Simplified event→extrinsic mapping
- No real-time subscription (historical only)
- No data validation beyond basic insertion

## Next Steps

For production use, consider:
1. Parallel block processing
2. Real-time subscription mode
3. Better error recovery
4. Data validation and verification
5. Metrics and monitoring
6. Database connection pooling optimization