import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search for .env in root directory and parent directories
const candidateEnvPaths = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env')
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'succeed_capital_crm_super_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Database configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'succeed_crm',
  DATABASE_URL: process.env.DATABASE_URL || null,
  
  // Static uploads configuration
  EXPOSE_UPLOADS_PUBLIC: process.env.EXPOSE_UPLOADS_PUBLIC !== 'false',
  
  // External integrations
  CREGIS_API_SECRET: process.env.CREGIS_API_SECRET || 'cregis_test_secret_key',
  JEXIPAY_SECRET_KEY: process.env.JEXIPAY_SECRET_KEY || 'jexipay_test_secret_key',
  SHUFTI_CLIENT_SECRET: process.env.SHUFTI_CLIENT_SECRET || 'shufti_test_secret_key',
  
  // Cloudflare Turnstile Configuration
  CF_TURNSTILE_SITE_KEY: process.env.CF_TURNSTILE_SITE_KEY || '1x00000000000000000000AA', // Cloudflare always passes test key
  CF_TURNSTILE_SECRET_KEY: process.env.CF_TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA', // Cloudflare test secret

  // Email SMTP Dispatcher Configuration
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'Vintage CRM <no-reply@vintagecrm.com>',
  CLIENT_BASE_URL: process.env.CLIENT_BASE_URL || 'http://localhost:5173',

  // MT5 SignalR Bridge Server URL
  MT5_BRIDGE_URL: process.env.MT5_BRIDGE_URL || 'http://localhost:8080/hubs/trading'
};
