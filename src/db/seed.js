import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import bcrypt from 'bcryptjs';

export const seedDatabase = async () => {
  console.log('🌱 Seeding default initial CRM administrative & demo data...');
  
  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  if (checkPgStatus()) {
    try {
      // Seed Super Admin if not exists
      await query(`
        INSERT INTO admin (name, email, password_hash, role)
        VALUES ('Super Admin', 'admin@succeedcapital.com', $1, 'super_admin')
        ON CONFLICT (email) DO NOTHING
      `, [adminPasswordHash]);

      // Seed Default Trader User if not exists
      await query(`
        INSERT INTO users (first_name, last_name, email, password_hash, country, phone, referral_code, kyc_status)
        VALUES ('John', 'Doe', 'trader@example.com', $1, 'United States', '+15550199', 'REF1001', 'verified')
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
