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
      email_verified: true,
      verification_token: null,
      reset_password_token: null,
      reset_password_expires: null,
      date_of_birth: '1992-05-14',
      address: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'OR',
      postal_code: '97477',
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: [],
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  user_sessions: [
    {
      id: 1,
      user_id: 1,
      ip_address: '127.0.0.1',
      user_agent: 'Chrome 128.0 (Windows NT 10.0)',
      device_info: 'Windows PC',
      last_active: new Date().toISOString(),
      is_current: true
    }
  ],
  admins: [
    {
      id: 1,
      name: 'Super Admin',
      email: 'admin@vintagecrm.com',
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
  mt5_trade_history: [
    { id: 1001, deal_id: 8810291, login: 501928, symbol: 'EURUSD', action: 'BUY', volume_lots: 1.50, open_price: 1.08450, close_price: 1.08920, profit: 705.00, close_time: '2026-08-16T14:30:00Z' },
    { id: 1002, deal_id: 8810292, login: 501928, symbol: 'GBPUSD', action: 'BUY', volume_lots: 1.00, open_price: 1.26100, close_price: 1.26750, profit: 650.00, close_time: '2026-08-15T11:15:00Z' },
    { id: 1003, deal_id: 8810293, login: 501928, symbol: 'XAUUSD', action: 'SELL', volume_lots: 0.50, open_price: 2420.50, close_price: 2410.00, profit: 525.00, close_time: '2026-08-14T18:00:00Z' },
    { id: 1004, deal_id: 8810294, login: 501928, symbol: 'BTCUSD', action: 'BUY', volume_lots: 0.10, open_price: 64200.00, close_price: 63800.00, profit: -400.00, close_time: '2026-08-13T09:45:00Z' },
    { id: 1005, deal_id: 8810295, login: 501928, symbol: 'USDJPY', action: 'SELL', volume_lots: 2.00, open_price: 154.200, close_price: 153.800, profit: 520.00, close_time: '2026-08-12T16:20:00Z' }
  ],
  wallets: [
    {
      id: 1,
      user_id: 1,
      wallet_number: 'W-90182',
      balance: 2500.00,
      locked_balance: 0.00,
      currency: 'USD',
      created_at: new Date().toISOString()
    }
  ],
  internal_transfers: [
    {
      id: 1,
      reference_id: 'TXN-INT-90182',
      user_id: 1,
      transfer_type: 'wallet_to_mt5',
      source_id: 'Wallet (W-90182)',
      destination_id: 'MT5 #501928',
      amount: 500.00,
      currency: 'USD',
      status: 'completed',
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
  withdrawals: [
    { id: 701, user_id: 1, amount: 500.00, network_fee: 1.00, net_amount: 499.00, currency: 'USD', payout_method: 'crypto_usdt', network: 'TRC20', destination_details: 'T9zXX9Kpq7aK9qP8291mLaZ387nK', tx_hash: '0x7a81092381029381', status: 'pending', created_at: '2026-08-16 16:20' },
    { id: 702, user_id: 1, amount: 200.00, network_fee: 0.00, net_amount: 200.00, currency: 'USD', payout_method: 'bank_wire', network: 'NATIVE', destination_details: 'IBAN: GB82 BARC 2020 1530 9018', tx_hash: 'BNK_WD_881029', status: 'approved', created_at: '2026-08-15 11:30' }
  ],
  address_book: [
    { id: 1, user_id: 1, label: 'My Binance TRC20 Wallet', method: 'crypto_usdt', network: 'TRC20', address: 'T9zXX9Kpq7aK9qP8291mLaZ387nK', is_whitelisted: true },
    { id: 2, user_id: 1, label: 'Personal Barclays IBAN', method: 'bank_wire', network: 'NATIVE', address: 'GB82 BARC 2020 1530 9018 29', is_whitelisted: true }
  ],
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
  pool = new Pool({ 
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
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
