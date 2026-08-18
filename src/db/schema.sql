-- ==============================================================================
-- SUCCEED CAPITAL CRM - FULL DATABASE SCHEMA DDL
-- Blueprint Specification: Postgres Database Tables for 3-Tier Broker CRM
-- ==============================================================================

-- 1. USER & AUTH DOMAIN
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  country VARCHAR(100) DEFAULT 'United States',
  phone VARCHAR(50),
  referral_code VARCHAR(50),
  kyc_status VARCHAR(30) DEFAULT 'unverified', -- 'unverified', 'pending', 'verified', 'rejected'
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMP WITH TIME ZONE,
  date_of_birth VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(50),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret VARCHAR(255),
  two_factor_backup_codes JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS admin (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'desk_admin', -- 'super_admin', 'desk_admin', 'compliance', 'country_partner'
  assigned_country VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES admin(id),
  action VARCHAR(255) NOT NULL,
  target_user_id INT,
  ip_address VARCHAR(45),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  event VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. MT5 & TRADING DOMAIN
CREATE TABLE IF NOT EXISTS trading_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  account_number VARCHAR(50) UNIQUE,
  login INT UNIQUE,
  platform VARCHAR(20) DEFAULT 'MT5',
  account_type VARCHAR(255) DEFAULT 'Standard',
  currency VARCHAR(10) DEFAULT 'USD',
  is_swap_free BOOLEAN DEFAULT FALSE,
  is_copy_account BOOLEAN DEFAULT FALSE,
  leverage VARCHAR(20) DEFAULT '100',
  reason_for_account TEXT,
  account_status VARCHAR(20) DEFAULT 'active',
  is_demo BOOLEAN DEFAULT FALSE,
  trading_server VARCHAR(100),
  master_password VARCHAR(255),
  investor_password VARCHAR(255),
  name VARCHAR(255),
  balance NUMERIC(15, 2) DEFAULT 0.00,
  equity NUMERIC(15, 2) DEFAULT 0.00,
  credit NUMERIC(15, 2) DEFAULT 0.00,
  free_margin NUMERIC(15, 2) DEFAULT 0.00,
  margin NUMERIC(15, 2) DEFAULT 0.00,
  mt5_group TEXT,
  custom_group_id INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mt5_trade_history (
  id SERIAL PRIMARY KEY,
  deal_id BIGINT UNIQUE NOT NULL,
  login INT NOT NULL,
  symbol VARCHAR(30) NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'BUY', 'SELL'
  volume_lots NUMERIC(10, 2) NOT NULL,
  open_price NUMERIC(15, 5),
  close_price NUMERIC(15, 5),
  profit NUMERIC(15, 2) NOT NULL,
  close_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. FINANCIAL DOMAIN
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wallet_number VARCHAR(50) UNIQUE NOT NULL,
  balance NUMERIC(15, 2) DEFAULT 0.00,
  locked_balance NUMERIC(15, 2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'USD',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS internal_transfers (
  id SERIAL PRIMARY KEY,
  reference_id VARCHAR(50) UNIQUE NOT NULL,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  transfer_type VARCHAR(50) NOT NULL, -- 'wallet_to_mt5', 'mt5_to_wallet', 'account_to_account'
  source_id VARCHAR(50) NOT NULL,
  destination_id VARCHAR(50) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  gateway VARCHAR(50) NOT NULL, -- 'manual_wire', 'cregis_crypto', 'jexipay'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  proof_file VARCHAR(255),
  tx_hash VARCHAR(255),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  network_fee NUMERIC(15, 2) DEFAULT 0.00,
  net_amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payout_method VARCHAR(50) NOT NULL, -- 'crypto_usdt', 'bank_wire', 'debit_card', 'skrill', 'neteller', 'local_depositor'
  network VARCHAR(50) DEFAULT 'TRC20', -- 'TRC20', 'ERC20', 'BEP20', 'NATIVE'
  destination_details TEXT NOT NULL,
  tx_hash VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- 4. IB AFFILIATE DOMAIN
CREATE TABLE IF NOT EXISTS ib_profiles (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  ib_code VARCHAR(50) UNIQUE NOT NULL,
  tier VARCHAR(50) DEFAULT 'Master IB', -- 'Master IB', 'Sub IB', 'Regional Partner'
  total_clients INT DEFAULT 0,
  total_lots NUMERIC(15, 2) DEFAULT 0.00,
  commission_balance NUMERIC(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ib_commission_ledger (
  id SERIAL PRIMARY KEY,
  ib_id INT REFERENCES ib_profiles(id),
  trade_deal_id BIGINT,
  trader_user_id INT REFERENCES users(id),
  symbol VARCHAR(30),
  lots NUMERIC(10, 2),
  commission_amount NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. COMPLIANCE DOMAIN (MANUAL & SHUFTI PRO DUAL-VERIFICATION)
CREATE TABLE IF NOT EXISTS kyc_verification (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  id_type VARCHAR(50),
  file_path VARCHAR(255) NOT NULL,
  file_data BYTEA,
  mime_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Pending',
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shufti_verifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference VARCHAR(255) NOT NULL UNIQUE,
  verification_url TEXT,
  status VARCHAR(64) DEFAULT 'pending',
  event_name VARCHAR(128),
  decline_reason TEXT,
  country VARCHAR(8),
  email VARCHAR(255),
  shufti_payload JSONB,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shufti_proofs (
  id SERIAL PRIMARY KEY,
  verification_id INT REFERENCES shufti_verifications(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference VARCHAR(255) NOT NULL,
  service VARCHAR(64) NOT NULL,
  proof_key VARCHAR(128) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_name VARCHAR(255),
  file_data BYTEA NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reference, service, proof_key)
);

CREATE TABLE IF NOT EXISTS shufti_webhook_events (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) NOT NULL,
  event_name VARCHAR(128) NOT NULL,
  event_time VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reference, event_name, event_time)
);

-- 6. SALES CRM DOMAIN
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  country VARCHAR(100),
  status VARCHAR(30) DEFAULT 'new', -- 'new', 'contacted', 'interested', 'converted', 'junk'
  assigned_to INT REFERENCES admin(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_activities (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  admin_id INT REFERENCES admin(id),
  activity_type VARCHAR(50), -- 'call', 'email', 'note', 'status_change'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. SUPPORT DOMAIN
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(100) NOT NULL,
  sender_type VARCHAR(20) NOT NULL, -- 'user', 'agent'
  sender_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. EXTERNAL CRM INTEROPERABILITY DOMAIN
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  crm_name VARCHAR(100) NOT NULL,
  api_key VARCHAR(100) UNIQUE NOT NULL,
  api_secret VARCHAR(100) NOT NULL,
  permissions JSONB DEFAULT '["all"]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_webhooks (
  id SERIAL PRIMARY KEY,
  api_key_id INT REFERENCES api_keys(id),
  target_url VARCHAR(255) NOT NULL,
  events JSONB NOT NULL, -- e.g. ["user.created", "deposit.approved", "trade.closed"]
  secret_signature VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
