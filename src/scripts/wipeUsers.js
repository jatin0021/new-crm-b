import { query, checkPgStatus, inMemoryStore, initDb } from '../config/db.js';

export const wipeAllUsers = async () => {
  console.log('🧹 Initiating full user wipe operation...');

  try {
    // Attempt database initialization if connection configured
    await initDb();

    if (checkPgStatus()) {
      console.log('🐘 PostgreSQL connected. Truncating users table with CASCADE...');
      
      // TRUNCATE users CASCADE will clear users and all tables with ON DELETE CASCADE constraints
      await query(`TRUNCATE TABLE users CASCADE;`);

      // Reset sequences if needed
      await query(`ALTER SEQUENCE users_id_seq RESTART WITH 1;`);
      
      console.log('✅ PostgreSQL user tables truncated successfully!');
    } else {
      console.log('ℹ️ PostgreSQL not active. Skipping DB truncation.');
    }

    // Reset In-Memory Store user collections
    console.log('💾 Resetting In-Memory fallback store user data...');
    inMemoryStore.users = [];
    inMemoryStore.user_sessions = [];
    inMemoryStore.trading_accounts = [];
    inMemoryStore.mt5_trade_history = [];
    inMemoryStore.wallets = [];
    inMemoryStore.internal_transfers = [];
    inMemoryStore.deposits = [];
    inMemoryStore.withdrawals = [];
    inMemoryStore.address_book = [];
    inMemoryStore.ib_profiles = [];
    
    console.log('✅ In-Memory store user data reset successfully!');
    console.log('✨ All users and associated financial/account records have been completely deleted.');
    return { success: true, message: 'All users and associated data wiped successfully' };
  } catch (err) {
    console.error('❌ Failed to wipe users:', err);
    throw err;
  }
};

if (process.argv[1]?.endsWith('wipeUsers.js')) {
  wipeAllUsers()
    .then(() => {
      console.log('Operation completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Operation failed:', err);
      process.exit(1);
    });
}
