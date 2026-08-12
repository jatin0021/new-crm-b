import bcrypt from 'bcryptjs';
import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

/**
 * External CRM Interoperability API Controller
 * Provides standardized Machine-to-Machine (M2M) endpoints allowing
 * external CRM platforms to communicate, sync users, manage MT5 accounts,
 * post financial credits/debits, and subscribe to real-time event webhooks.
 */

// 1. Synchronize / Create User from External CRM
export const syncExternalUser = async (req, res) => {
  const { first_name, last_name, email, password, country, phone, external_id } = req.body;

  if (!email || !first_name || !last_name) {
    return res.status(400).json({ message: 'First name, last name, and email are required for external user sync' });
  }

  try {
    let user = null;
    const defaultPassword = password || 'ExternalPass#2026';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    if (checkPgStatus()) {
      const existingRes = await query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
      if (existingRes.rows.length > 0) {
        user = existingRes.rows[0];
      } else {
        const createRes = await query(
          `INSERT INTO users (first_name, last_name, email, password_hash, country, phone, referral_code, kyc_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'unverified') RETURNING *`,
          [first_name, last_name, email.toLowerCase(), passwordHash, country || 'Global', phone || '', `EXT-${external_id || Math.floor(1000+Math.random()*9000)}`]
        );
        user = createRes.rows[0];
        await query(`INSERT INTO wallets (user_id, wallet_number, balance) VALUES ($1, $2, 0.00)`, [user.id, `W-EXT-${user.id}`]);
      }
    } else {
      user = inMemoryStore.users.find(u => u.email === email.toLowerCase());
      if (!user) {
        user = {
          id: inMemoryStore.users.length + 200,
          first_name,
          last_name,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          country: country || 'Global',
          phone: phone || '',
          referral_code: `EXT-${external_id || 'CRM'}`,
          kyc_status: 'unverified',
          is_active: true,
          created_at: new Date().toISOString()
        };
        inMemoryStore.users.push(user);
        inMemoryStore.wallets.push({
          id: inMemoryStore.wallets.length + 1,
          user_id: user.id,
          wallet_number: `W-EXT-${user.id}`,
          balance: 0.00,
          currency: 'USD'
        });
      }
    }

    return res.status(200).json({
      message: 'User synchronized successfully with external CRM',
      data: {
        crm_source: req.externalCrm?.name || 'External System',
        internal_user_id: user.id,
        email: user.email,
        kyc_status: user.kyc_status,
        created_at: user.created_at
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'External user sync failed', error: err.message });
  }
};

// 2. Fetch User Profile and Accounts for External CRM
export const getExternalUser = async (req, res) => {
  const { identifier } = req.params; // Can be user_id or email

  try {
    let user = null;
    let accounts = [];
    let wallet = null;

    const isNumeric = /^\d+$/.test(identifier);

    if (checkPgStatus()) {
      const userRes = await query(
        isNumeric ? `SELECT id, first_name, last_name, email, country, kyc_status, created_at FROM users WHERE id = $1` : `SELECT id, first_name, last_name, email, country, kyc_status, created_at FROM users WHERE email = $1`,
        [isNumeric ? parseInt(identifier) : identifier.toLowerCase()]
      );
      user = userRes.rows[0];

      if (user) {
        const accRes = await query(`SELECT login, account_type, group_type, leverage, balance, equity FROM trading_accounts WHERE user_id = $1`, [user.id]);
        accounts = accRes.rows;
        const wRes = await query(`SELECT wallet_number, balance, currency FROM wallets WHERE user_id = $1`, [user.id]);
        wallet = wRes.rows[0];
      }
    } else {
      user = inMemoryStore.users.find(u => isNumeric ? u.id === parseInt(identifier) : u.email === identifier.toLowerCase());
      if (user) {
        accounts = inMemoryStore.trading_accounts.filter(a => a.user_id === user.id);
        wallet = inMemoryStore.wallets.find(w => w.user_id === user.id);
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found in CRM system' });
    }

    return res.json({
      message: 'External user profile & account details fetched',
      data: { user, wallet, trading_accounts: accounts }
    });
  } catch (err) {
    return res.status(500).json({ message: 'External user retrieval failed', error: err.message });
  }
};

// 3. Provision MT5 Account from External CRM
export const provisionExternalAccount = async (req, res) => {
  const { user_email, account_type, group_type, leverage } = req.body;

  if (!user_email) {
    return res.status(400).json({ message: 'User email is required' });
  }

  try {
    let user = null;
    if (checkPgStatus()) {
      const uRes = await query(`SELECT id FROM users WHERE email = $1`, [user_email.toLowerCase()]);
      user = uRes.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === user_email.toLowerCase());
    }

    if (!user) {
      return res.status(404).json({ message: `User with email '${user_email}' not found. Please sync user first.` });
    }

    const type = account_type === 'demo' ? 'demo' : 'live';
    const loginNumber = Math.floor(600000 + Math.random() * 300000);
    const masterPass = `ExtMst#${Math.floor(100000 + Math.random() * 800000)}`;
    const investorPass = `ExtInv#${Math.floor(100000 + Math.random() * 800000)}`;

    let newAcc = null;

    if (checkPgStatus()) {
      const resVal = await query(
        `INSERT INTO trading_accounts (user_id, login, account_type, group_type, leverage, master_password, investor_password, balance, equity, free_margin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0.00, 0.00, 0.00) RETURNING *`,
        [user.id, loginNumber, type, group_type || 'Standard ECN', leverage || '1:500', masterPass, investorPass]
      );
      newAcc = resVal.rows[0];
    } else {
      newAcc = {
        id: inMemoryStore.trading_accounts.length + 300,
        user_id: user.id,
        login: loginNumber,
        account_type: type,
        group_type: group_type || 'Standard ECN',
        leverage: leverage || '1:500',
        master_password: masterPass,
        investor_password: investorPass,
        balance: 0.00,
        equity: 0.00,
        free_margin: 0.00,
        currency: 'USD',
        created_at: new Date().toISOString()
      };
      inMemoryStore.trading_accounts.push(newAcc);
    }

    return res.status(201).json({
      message: 'MT5 Trading account provisioned remotely via External CRM API',
      data: {
        login: newAcc.login,
        account_type: newAcc.account_type,
        leverage: newAcc.leverage,
        master_password: newAcc.master_password,
        investor_password: newAcc.investor_password
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Remote account provisioning failed', error: err.message });
  }
};

// 4. Post Financial Deposit / Credit from External CRM
export const postExternalDeposit = async (req, res) => {
  const { user_email, login, amount, external_tx_id, notes } = req.body;

  const depAmount = parseFloat(amount);
  if (!user_email || !depAmount || depAmount <= 0) {
    return res.status(400).json({ message: 'User email and valid deposit amount are required' });
  }

  try {
    let user = null;
    if (checkPgStatus()) {
      const uRes = await query(`SELECT id FROM users WHERE email = $1`, [user_email.toLowerCase()]);
      user = uRes.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === user_email.toLowerCase());
    }

    if (!user) {
      return res.status(404).json({ message: `User '${user_email}' not found` });
    }

    if (login) {
      // Credit directly to trading account login
      if (checkPgStatus()) {
        await query(`UPDATE trading_accounts SET balance = balance + $1, equity = equity + $1 WHERE login = $2 AND user_id = $3`, [depAmount, login, user.id]);
      } else {
        const acc = inMemoryStore.trading_accounts.find(a => a.login === parseInt(login) && a.user_id === user.id);
        if (acc) {
          acc.balance += depAmount;
          acc.equity += depAmount;
        }
      }
    } else {
      // Credit to internal CRM wallet
      if (checkPgStatus()) {
        await query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [depAmount, user.id]);
      } else {
        const wallet = inMemoryStore.wallets.find(w => w.user_id === user.id);
        if (wallet) wallet.balance += depAmount;
      }
    }

    return res.status(200).json({
      message: `Successfully posted external deposit of $${depAmount.toFixed(2)} to ${user_email}`,
      data: {
        user_email,
        target: login ? `MT5 Account #${login}` : 'Internal Wallet',
        credited_amount: depAmount,
        external_tx_id: external_tx_id || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'External deposit posting failed', error: err.message });
  }
};

// 5. Register Webhook Subscription for External CRM
export const subscribeExternalWebhook = async (req, res) => {
  const { target_url, events, secret_signature } = req.body;

  if (!target_url || !events || !Array.isArray(events)) {
    return res.status(400).json({ message: 'Target URL and events array (e.g. ["user.created", "deposit.approved"]) are required' });
  }

  try {
    let webhook = null;

    if (checkPgStatus()) {
      const resVal = await query(
        `INSERT INTO external_webhooks (api_key_id, target_url, events, secret_signature)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.externalCrm.id, target_url, JSON.stringify(events), secret_signature || null]
      );
      webhook = resVal.rows[0];
    } else {
      webhook = {
        id: inMemoryStore.external_webhooks.length + 1,
        api_key_id: req.externalCrm.id,
        target_url,
        events,
        secret_signature: secret_signature || null,
        is_active: true,
        created_at: new Date().toISOString()
      };
      inMemoryStore.external_webhooks.push(webhook);
    }

    return res.status(201).json({
      message: 'External CRM webhook subscription registered successfully',
      data: { webhook }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Webhook registration failed', error: err.message });
  }
};
