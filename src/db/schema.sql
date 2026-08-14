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
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
  login INT UNIQUE NOT NULL,
  account_type VARCHAR(20) DEFAULT 'live', -- 'live', 'demo'
  group_type VARCHAR(100) DEFAULT 'Standard ECN',
  leverage VARCHAR(20) DEFAULT '1:500',
  master_password VARCHAR(100),
  investor_password VARCHAR(100),
  balance NUMERIC(15, 2) DEFAULT 0.00,
  equity NUMERIC(15, 2) DEFAULT 0.00,
  free_margin NUMERIC(15, 2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
  currency VARCHAR(10) DEFAULT 'USD',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
  currency VARCHAR(10) DEFAULT 'USD',
  payout_method VARCHAR(50) NOT NULL, -- 'crypto_usdt', 'bank_wire'
  destination_details TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes TEXT,
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

-- 5. COMPLIANCE DOMAIN
CREATE TABLE IF NOT EXISTS kyc_verification (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  id_document_url VARCHAR(255),
  proof_address_url VARCHAR(255),
  status VARCHAR(30) DEFAULT 'pending',
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS shufti_kyc (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  reference_id VARCHAR(100) UNIQUE,
  event VARCHAR(50),
  verification_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- 9. PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
