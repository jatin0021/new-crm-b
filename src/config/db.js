import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;
let isPgConnected = false;
let dbInitPromise = null;

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
  // Strip conflicting sslmode parameter from connection string to allow ssl rejectUnauthorized: false setting in pg Pool
  const cleanUrl = env.DATABASE_URL.replace(/[\?&]sslmode=[^&]*/g, '');
  pool = new Pool({ 
    connectionString: cleanUrl,
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

// Attach error listener to prevent unhandled PG pool error crashes
if (pool) {
  pool.on('error', (err) => {
    console.warn(`⚠️ Unexpected PostgreSQL Pool error: ${err.message}`);
    isPgConnected = false;
  });
}

// Check Database Connection & Auto-initialize Schema DDL on startup
export const initDb = async () => {
  if (process.env.VERCEL && !env.DATABASE_URL) {
    console.log('ℹ️ Running on Vercel serverless without DATABASE_URL. PostgreSQL skipped; using dynamic in-memory store.');
    isPgConnected = false;
    return;
  }

  try {
    const client = await pool.connect();
    isPgConnected = true;
    console.log('PostgreSQL Database Connected Successfully.');

    // Auto-create database tables if not existing
    try {
      const schemaPath = path.join(__dirname, '../db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(sql);
        console.log('✅ PostgreSQL Database Tables Schema Verified.');
      }
    } catch (schemaErr) {
      console.warn(`⚠️ Schema initialization check warning: ${schemaErr.message}`);
    }

    // Auto-seed default Super Admin and Trader user if tables are empty
    try {
      const adminCountRes = await client.query('SELECT COUNT(*) FROM admin');
      if (parseInt(adminCountRes.rows[0].count) === 0) {
        await client.query(
          `INSERT INTO admin (name, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5)`,
          ['Super Admin', 'admin@vintagecrm.com', '$2a$10$98DjtE95HYl6syLy91pwpOQptPaxHkB68itYHaVutWZ4BnYi2B6S6', 'super_admin', true]
        );
        console.log('✅ Default Super Admin seeded into Supabase PostgreSQL.');
      }

      const userCountRes = await client.query('SELECT COUNT(*) FROM users');
      if (parseInt(userCountRes.rows[0].count) === 0) {
        const userRes = await client.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, country, phone, referral_code, kyc_status, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          ['John', 'Doe', 'trader@example.com', '$2a$10$98DjtE95HYl6syLy91pwpOQptPaxHkB68itYHaVutWZ4BnYi2B6S6', 'United States', '+15550199', 'REF1001', 'verified', true]
        );
        const userId = userRes.rows[0].id;
        
        await client.query(
          `INSERT INTO wallets (user_id, wallet_number, balance, currency)
           VALUES ($1, $2, 2500.00, 'USD') ON CONFLICT DO NOTHING`,
          [userId, 'W-90182']
        );

        await client.query(
          `INSERT INTO trading_accounts (user_id, login, account_type, group_type, leverage, balance, equity, free_margin, currency)
           VALUES ($1, $2, 'live', 'Standard ECN', '1:500', 15400.50, 15890.20, 12400.00, 'USD') ON CONFLICT DO NOTHING`,
          [userId, 501928]
        );
        console.log('✅ Default Trader user and wallet seeded into Supabase PostgreSQL.');
      }
    } catch (seedErr) {
      console.warn(`⚠️ Seeding check warning: ${seedErr.message}`);
    }

    client.release();
  } catch (err) {
    isPgConnected = false;
    console.warn(`⚠️ PostgreSQL connection warning: ${err.message}. Using dynamic in-memory store fallback.`);
  }
};

export const ensureDbInitialized = async () => {
  if (isPgConnected) return true;
  if (!dbInitPromise) {
    dbInitPromise = initDb();
  }
  await dbInitPromise;
  return isPgConnected;
};

export const query = async (text, params) => {
  await ensureDbInitialized();
  if (isPgConnected && pool) {
    return pool.query(text, params);
  }
  
  // Return dummy successful result wrapper for query calls when running without active PG server
  return { rows: [], rowCount: 0 };
};

export const checkPgStatus = () => isPgConnected;

export default { query, initDb, ensureDbInitialized, checkPgStatus, inMemoryStore };
