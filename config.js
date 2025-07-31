require('dotenv').config();

const config = {
  database: {
    user: process.env.DB_USER,
    // password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 1,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  },
  
  avail: {
    rpcUrl: process.env.AVAIL_RPC_URL,
    startBlock: parseInt(process.env.START_BLOCK) || 150000,
    endBlock: parseInt(process.env.END_BLOCK) || 150010,
    requestDelay: parseInt(process.env.REQUEST_DELAY) || 1000,
  },
  
  // Validation
  validate() {
    const required = [
      'DB_USER', 'DB_PASS', 'DB_DATABASE', 'DB_HOST', 
      'AVAIL_RPC_URL', 'START_BLOCK', 'END_BLOCK'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    if (this.avail.startBlock >= this.avail.endBlock) {
      throw new Error('START_BLOCK must be less than END_BLOCK');
    }
    
    console.log(`Configuration loaded: blocks ${this.avail.startBlock}-${this.avail.endBlock}`);
  }
};

module.exports = config;