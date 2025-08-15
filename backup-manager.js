// Database Backup Manager for Safe Account Restoration
require('dotenv').config();
const { Pool } = require('pg');

class BackupManager {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            max: 5,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 30000
        });

        this.pool.on('error', (err) => {
            console.error('Database pool error:', err);
        });
    }

    async query(text, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    // Create backup tables for specific block range
    async createBackupTables(startBlock, endBlock, suffix = '') {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const backupSuffix = suffix || `_backup_${timestamp}`;
        
        console.log(`🔒 Creating backup tables for blocks ${startBlock}-${endBlock}...`);
        
        try {
            const balanceBackupTable = `balance_history${backupSuffix}`;
            const profilesBackupTable = `account_profiles${backupSuffix}`;
            
            // Auto-cleanup: Drop existing backup tables if they exist
            console.log(`  🧹 Auto-cleanup: Removing any existing backup tables...`);
            await this.query(`DROP TABLE IF EXISTS ${balanceBackupTable}`);
            await this.query(`DROP TABLE IF EXISTS ${profilesBackupTable}`);
            
            // Backup balance_history for block range
            await this.query(`
                CREATE TABLE ${balanceBackupTable} AS 
                SELECT * FROM balance_history 
                WHERE block_number BETWEEN $1 AND $2
            `, [startBlock, endBlock]);
            
            const balanceCount = await this.query(`SELECT COUNT(*) as count FROM ${balanceBackupTable}`);
            console.log(`  ✅ ${balanceBackupTable}: ${balanceCount.rows[0].count} records`);
            
            // Backup full account_profiles table (needed for foreign keys)
            await this.query(`
                CREATE TABLE ${profilesBackupTable} AS 
                SELECT * FROM account_profiles
            `);
            
            const profilesCount = await this.query(`SELECT COUNT(*) as count FROM ${profilesBackupTable}`);
            console.log(`  ✅ ${profilesBackupTable}: ${profilesCount.rows[0].count} records`);
            
            return {
                balanceTable: balanceBackupTable,
                profilesTable: profilesBackupTable,
                timestamp: timestamp
            };
            
        } catch (error) {
            console.error('❌ Backup creation failed:', error.message);
            throw error;
        }
    }

    // Restore from backup tables
    async restoreFromBackup(backupInfo) {
        console.log(`🔄 Restoring from backup tables...`);
        
        try {
            // Use transaction for atomicity
            const client = await this.pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // Restore balance_history
                console.log('  🔄 Restoring balance_history...');
                const balanceRange = await client.query(`
                    SELECT MIN(block_number) as min_block, MAX(block_number) as max_block 
                    FROM ${backupInfo.balanceTable}
                `);
                
                const minBlock = balanceRange.rows[0].min_block;
                const maxBlock = balanceRange.rows[0].max_block;
                
                // Delete current data in range
                await client.query(`
                    DELETE FROM balance_history 
                    WHERE block_number BETWEEN $1 AND $2
                `, [minBlock, maxBlock]);
                
                // Restore from backup
                await client.query(`
                    INSERT INTO balance_history 
                    SELECT * FROM ${backupInfo.balanceTable}
                `);
                
                // Restore account_profiles (full replacement)
                console.log('  🔄 Restoring account_profiles...');
                await client.query('TRUNCATE account_profiles CASCADE');
                await client.query(`
                    INSERT INTO account_profiles 
                    SELECT * FROM ${backupInfo.profilesTable}
                `);
                
                await client.query('COMMIT');
                console.log('  ✅ Restore completed successfully');
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('❌ Restore failed:', error.message);
            throw error;
        }
    }

    // Clean up old backup tables
    async cleanupBackups(backupInfo) {
        console.log(`🗑️  Cleaning up backup tables...`);
        
        try {
            await this.query(`DROP TABLE IF EXISTS ${backupInfo.balanceTable}`);
            await this.query(`DROP TABLE IF EXISTS ${backupInfo.profilesTable}`);
            console.log('  ✅ Backup tables cleaned up');
            
        } catch (error) {
            console.error('⚠️  Backup cleanup warning:', error.message);
            // Don't throw - cleanup failures shouldn't stop main process
        }
    }

    async close() {
        await this.pool.end();
        console.log('🔌 Backup manager disconnected');
    }
}

module.exports = { BackupManager };