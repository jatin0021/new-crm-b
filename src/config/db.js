import pkg from 'pg';
const { Pool } = pkg;
import { env } from './env.js';

let pool = null;
let isPgConnected = false;

// In-Memory Data Fallback Store for Instant Out-of-the-Box Operation
export const inMemoryStore = {
  users: [
    {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'trader@example.com',
      password_hash: '$2a$10$98DjtE95HYl6syLy91pwpOQptPaxHkB68itYHaVutWZ4BnYi2B6S6', // 'password123'
      country: 'United States',
      phone: '+15550199',
      referral_code: 'REF1001',
      kyc_status: 'verified',
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  admins: [
    {
      id: 1,
      name: 'Super Admin',
      email: 'admin@succeedcapital.com',
      password_hash: '$2a$10$98DjtE95HYl6syLy91pwpOQptPaxHkB68itYHaVutWZ4BnYi2B6S6', // 'password123'
      role: 'super_admin',
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  trading_accounts: [
    {
      id: 101,
      user_id: 1,
      login: 501928,
      account_type: 'live',
      group_type: 'Standard ECN',
      leverage: '1:500',
      balance: 15400.50,
      equity: 15890.20,
      free_margin: 12400.00,
      currency: 'USD',
      created_at: new Date().toISOString()
    }
  ],
  wallets: [
    {
      id: 1,
      user_id: 1,
      wallet_number: 'W-90182',
      balance: 2500.00,
      currency: 'USD',
      created_at: new Date().toISOString()
    }
  ],
  deposits: [
    {
      id: 501,
      user_id: 1,
      amount: 1000.00,
      currency: 'USD',
      gateway: 'cregis_crypto',
      status: 'approved',
      tx_hash: '0x8f3c91a0b...',
      created_at: new Date().toISOString()
    }
  ],
  withdrawals: [],
  ib_profiles: [
    {
      id: 1,
      user_id: 1,
      ib_code: 'IB-9921',
      tier: 'Master IB',
      total_clients: 12,
      total_lots: 345.5,
      commission_balance: 1727.50,
      created_at: new Date().toISOString()
    }
  ],
  leads: [
    {
      id: 1,
      first_name: 'Alex',
      last_name: 'Smith',
      email: 'alex@example.com',
      phone: '+447700900077',
      country: 'United Kingdom',
      status: 'new',
      assigned_to: 1,
      created_at: new Date().toISOString()
    }
  ],
  api_keys: [
    {
      id: 1,
      crm_name: 'External CRM Gateway Alpha',
      api_key: 'crm_key_live_88391029381',
      api_secret: 'crm_sec_live_99201928374',
      is_active: true,
      permissions: ['all'],
      created_at: new Date().toISOString()
    }
  ],
  external_webhooks: []
};

// Initialize PostgreSQL Pool
if (env.DATABASE_URL) {
  pool = new Pool({ connectionString: env.DATABASE_URL });
} else {
  pool = new Pool({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });
}

// Check Database Connection on startup
export const initDb = async () => {
  try {
    const client = await pool.connect();
    isPgConnected = true;
    console.log('PostgreSQL Database Connected Successfully.');
    client.release();
  } catch (err) {
    isPgConnected = false;
    console.warn(`⚠️ PostgreSQL connection warning: ${err.message}. Using dynamic in-memory store fallback.`);
  }
};

export const query = async (text, params) => {
  if (isPgConnected && pool) {
    return pool.query(text, params);
  }
  
  // Return dummy successful result wrapper for query calls when running without active PG server
  return { rows: [], rowCount: 0 };
};

export const checkPgStatus = () => isPgConnected;

export default { query, initDb, checkPgStatus, inMemoryStore };
