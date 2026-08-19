import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import bcrypt from 'bcryptjs';

export const seedDatabase = async () => {
  console.log('🌱 Seeding default initial CRM administrative & demo data...');
  
  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  if (checkPgStatus()) {
    try {
      // Ensure Schema Migrations for User Auth & Access Control
      await query(`ALTER TABLE users DROP COLUMN IF EXISTS phone;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(50);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(50);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]'::jsonb;`);
      await query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255),
          ip_address VARCHAR(45),
          user_agent TEXT,
          device_info VARCHAR(100),
          last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS locked_balance NUMERIC(15, 2) DEFAULT 0.00;`);
      await query(`
        CREATE TABLE IF NOT EXISTS internal_transfers (
          id SERIAL PRIMARY KEY,
          reference_id VARCHAR(50) UNIQUE NOT NULL,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          transfer_type VARCHAR(50) NOT NULL,
          source_id VARCHAR(50) NOT NULL,
          destination_id VARCHAR(50) NOT NULL,
          amount NUMERIC(15, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          status VARCHAR(20) DEFAULT 'completed',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS network_fee NUMERIC(15, 2) DEFAULT 0.00;`);
      await query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS net_amount NUMERIC(15, 2) DEFAULT 0.00;`);
      await query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS network VARCHAR(50) DEFAULT 'TRC20';`);
      await query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(255);`);
      await query(`
        CREATE TABLE IF NOT EXISTS address_book (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          label VARCHAR(100) NOT NULL,
          method VARCHAR(50) NOT NULL,
          address TEXT NOT NULL,
          network VARCHAR(50) DEFAULT 'TRC20',
          is_whitelisted BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed Super Admin if not exists
      await query(`
        INSERT INTO admin (name, email, password_hash, role)
        VALUES ('Super Admin', 'admin@vintagecrm.com', $1, 'super_admin')
        ON CONFLICT (email) DO NOTHING
      `, [adminPasswordHash]);

      // Seed Default Trader User if not exists
      await query(`
        INSERT INTO users (first_name, last_name, email, password_hash, country, phone, referral_code, kyc_status, email_verified)
        VALUES ('John', 'Doe', 'trader@example.com', $1, 'United States', '+15550199', 'REF1001', 'verified', TRUE)
        ON CONFLICT (email) DO NOTHING
      `, [defaultPasswordHash]);

      // Seed API Key for External CRM Interoperability
      await query(`
        INSERT INTO api_keys (crm_name, api_key, api_secret, permissions)
        VALUES ('External Partner CRM', 'crm_key_live_88391029381', 'crm_sec_live_99201928374', '["all"]')
        ON CONFLICT (api_key) DO NOTHING
      `);

      console.log('✅ Database seeded successfully into PostgreSQL!');
    } catch (err) {
      console.error('Error seeding Postgres DB:', err.message);
    }
  } else {
    console.log('✅ In-memory demo data store initialized automatically!');
  }
};

if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().then(() => process.exit(0));
}
