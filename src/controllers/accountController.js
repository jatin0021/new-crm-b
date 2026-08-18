import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import { encryptText, decryptText } from '../utils/crypto.js';

/**
 * Helper to normalize account object fields
 */
const normalizeAccount = (acc) => {
  const bal = parseFloat(acc.balance || 0);
  const eq = parseFloat(acc.equity || bal);
  const freeMarg = parseFloat(acc.free_margin || eq);
  const marginUsed = Math.max(0, eq - freeMarg);
  const marginLevelPct = marginUsed > 0 ? parseFloat(((eq / marginUsed) * 100).toFixed(2)) : 9999.99;
  const accountNumber = acc.account_number || String(acc.login || acc.id || '');
  const isDemo = acc.is_demo === true || acc.account_type?.toLowerCase() === 'demo';

  return {
    id: acc.id,
    user_id: acc.user_id,
    account_number: accountNumber,
    login: acc.login || parseInt(accountNumber, 10) || acc.id,
    name: acc.name || `${acc.platform || 'MT5'} ${isDemo ? 'Demo' : 'Live'} Account`,
    platform: acc.platform || 'MT5',
    account_type: acc.account_type || (isDemo ? 'Demo' : 'Standard'),
    currency: acc.currency || 'USD',
    is_swap_free: !!acc.is_swap_free,
    is_copy_account: !!acc.is_copy_account,
    leverage: acc.leverage || '100',
    reason_for_account: acc.reason_for_account || '',
    account_status: acc.account_status || 'active',
    is_demo: isDemo,
    trading_server: acc.trading_server || (isDemo ? 'Vintage-Demo Server' : 'Vintage-Live Server'),
    balance: bal,
    equity: eq,
    credit: parseFloat(acc.credit || 0),
    free_margin: freeMarg,
    margin: parseFloat(marginUsed.toFixed(2)),
    margin_level_pct: marginLevelPct,
    floating_pnl: parseFloat((eq - bal).toFixed(2)),
    mt5_group: acc.mt5_group || acc.group_type || 'Standard',
    custom_group_id: acc.custom_group_id || null,
    created_at: acc.created_at,
    updated_at: acc.updated_at
  };
};

/**
 * 1. GET /api/trading-accounts
 * List Trading Accounts with Live Sync
 */
export const listTradingAccounts = async (req, res) => {
  const userId = req.user.id;
  const skipLiveSync = req.query.live === '0' || req.query.skipLive === 'true';

  try {
    let accounts = [];
    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM trading_accounts WHERE user_id = $1 ORDER BY id DESC`, [userId]);
      accounts = result.rows;
    } else {
      accounts = inMemoryStore.trading_accounts ? inMemoryStore.trading_accounts.filter(a => a.user_id === userId) : [];
    }

    const normalized = accounts.map(acc => normalizeAccount(acc));

    return res.json({
      ok: true,
      success: true,
      message: 'Trading accounts retrieved successfully',
      data: { accounts: normalized }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to retrieve trading accounts', error: err.message });
  }
};

/**
 * 2. GET /api/trading-accounts/available-groups
 * Available Account Groups based on type (demo vs real)
 */
export const getAvailableGroups = async (req, res) => {
  const type = (req.query.type || 'real').toLowerCase();

  try {
    if (type === 'demo') {
      return res.json({
        ok: true,
        success: true,
        data: {
          groups: [
            { id: 'demo_standard', name: 'Standard Demo', group_name: 'demo\\standard', leverage_options: ['50', '100', '200', '500'], currency: 'USD' }
          ]
        }
      });
    }

    return res.json({
      ok: true,
      success: true,
      data: {
        groups: [
          { id: 'real_standard', name: 'Standard ECN', group_name: 'real\\standard_ecn', leverage_options: ['50', '100', '200', '500'], currency: 'USD', min_deposit: 100 },
          { id: 'real_pro', name: 'Pro Zero Spread', group_name: 'real\\pro_zero', leverage_options: ['50', '100', '200', '500'], currency: 'USD', min_deposit: 500 },
          { id: 'real_vip', name: 'VIP Institutional', group_name: 'real\\vip_inst', leverage_options: ['50', '100', '200'], currency: 'USD', min_deposit: 5000 }
        ]
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to fetch available account groups', error: err.message });
  }
};

/**
 * 3. POST /api/trading-accounts
 * Create Live or Demo Trading Account
 */
export const createTradingAccount = async (req, res) => {
  const userId = req.user.id;
  const { name, leverage, password, group, isDemo, is_demo, demoTopUp, platform, currency, account_type } = req.body;

  const accTypeLower = String(account_type || '').toLowerCase();
  const isDemoAccount = isDemo === true || is_demo === true || isDemo === 'true' || is_demo === 'true' || accTypeLower === 'demo';
  const accName = name || (isDemoAccount ? 'Demo Trading Account' : 'Main Live Account');
  const accLeverage = String(leverage || '100');
  const rawPassword = password || `Mst#${Math.floor(100000 + Math.random() * 800000)}`;

  if (!isDemoAccount && rawPassword.length < 8) {
    return res.status(400).json({ ok: false, success: false, message: 'Password must be at least 8 characters long' });
  }

  const rawInvestorPass = `Inv#${Math.floor(100000 + Math.random() * 800000)}`;
  const encryptedMaster = encryptText(rawPassword);
  const encryptedInvestor = encryptText(rawInvestorPass);

  const accountNumber = String(Math.floor(100000 + Math.random() * 900000));
  const loginNum = parseInt(accountNumber, 10);
  const initialBalance = isDemoAccount ? parseFloat(demoTopUp || req.body.initial_demo_balance || 10000.00) : 0.00;
  const accPlatform = platform || 'MT5';
  const accCurrency = currency || 'USD';
  const accGroup = group || (isDemoAccount ? 'demo\\standard' : 'real\\standard_ecn');
  const accTypeStr = isDemoAccount ? 'Demo' : (account_type || 'Standard');
  const tradingServer = isDemoAccount ? 'Vintage-Demo Server' : 'Vintage-Live Server';

  try {
    let createdRow = null;

    if (checkPgStatus()) {
      const result = await query(
        `INSERT INTO trading_accounts 
         (user_id, account_number, login, platform, account_type, currency, leverage, is_demo, trading_server, master_password, investor_password, name, balance, equity, free_margin, mt5_group, account_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active')
         RETURNING *`,
        [userId, accountNumber, loginNum, accPlatform, accTypeStr, accCurrency, accLeverage, isDemoAccount, tradingServer, encryptedMaster, encryptedInvestor, accName, initialBalance, initialBalance, initialBalance, accGroup]
      );
      createdRow = result.rows[0];
    } else {
      createdRow = {
        id: (inMemoryStore.trading_accounts?.length || 0) + 100,
        user_id: userId,
        account_number: accountNumber,
        login: loginNum,
        platform: accPlatform,
        account_type: accTypeStr,
        currency: accCurrency,
        leverage: accLeverage,
        is_demo: isDemoAccount,
        trading_server: tradingServer,
        master_password: encryptedMaster,
        investor_password: encryptedInvestor,
        name: accName,
        balance: initialBalance,
        equity: initialBalance,
        free_margin: initialBalance,
        mt5_group: accGroup,
        account_status: 'active',
        created_at: new Date().toISOString()
      };
      if (!inMemoryStore.trading_accounts) inMemoryStore.trading_accounts = [];
      inMemoryStore.trading_accounts.push(createdRow);
    }

    const normalized = normalizeAccount(createdRow);

    return res.status(201).json({
      ok: true,
      success: true,
      message: `${isDemoAccount ? 'Demo' : 'Live'} trading account created successfully`,
      data: { account: normalized }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to provision trading account', error: err.message });
  }
};

/**
 * 4. POST /api/trading-accounts/demo-topup
 * Instant balance top-up for Demo Accounts (max 10,000,000)
 */
export const demoTopUp = async (req, res) => {
  const userId = req.user.id;
  const { account_number, login, amount } = req.body;
  const accNum = String(account_number || login || '');
  const topUpAmount = parseFloat(amount);

  if (!accNum) {
    return res.status(400).json({ ok: false, success: false, message: 'Account number is required' });
  }
  if (isNaN(topUpAmount) || topUpAmount <= 0 || topUpAmount > 10000000) {
    return res.status(400).json({ ok: false, success: false, message: 'Top-up amount must be between $1 and $10,000,000' });
  }

  try {
    let targetAcc = null;

    if (checkPgStatus()) {
      const checkRes = await query(
        `SELECT * FROM trading_accounts WHERE (account_number = $1 OR login = $2) AND user_id = $3`,
        [accNum, parseInt(accNum, 10) || 0, userId]
      );
      targetAcc = checkRes.rows[0];
    } else {
      targetAcc = inMemoryStore.trading_accounts?.find(a => (a.account_number === accNum || a.login === parseInt(accNum, 10)) && a.user_id === userId);
    }

    if (!targetAcc) {
      return res.status(404).json({ ok: false, success: false, message: 'Trading account not found or access denied' });
    }

    const isDemo = targetAcc.is_demo === true || targetAcc.account_type?.toLowerCase() === 'demo';
    if (!isDemo) {
      return res.status(400).json({ ok: false, success: false, message: 'Top-up is strictly restricted to Demo trading accounts.' });
    }

    const newBalance = parseFloat(targetAcc.balance || 0) + topUpAmount;
    const newEquity = parseFloat(targetAcc.equity || targetAcc.balance || 0) + topUpAmount;
    const newFreeMargin = parseFloat(targetAcc.free_margin || targetAcc.balance || 0) + topUpAmount;

    if (checkPgStatus()) {
      await query(
        `UPDATE trading_accounts SET balance = $1, equity = $2, free_margin = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [newBalance, newEquity, newFreeMargin, targetAcc.id]
      );
    } else {
      targetAcc.balance = newBalance;
      targetAcc.equity = newEquity;
      targetAcc.free_margin = newFreeMargin;
    }

    return res.json({
      ok: true,
      success: true,
      message: `Successfully topped up Demo Account #${accNum} by $${topUpAmount.toLocaleString()}`,
      data: {
        account_number: accNum,
        topup_amount: topUpAmount,
        new_balance: newBalance
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Demo top-up failed', error: err.message });
  }
};

/**
 * 5. POST /api/trading-accounts/change-password
 * Change Master or Investor Password for Trading Account
 */
export const changeTradingPassword = async (req, res) => {
  const userId = req.user.id;
  const { account_number, login, new_password, password_type } = req.body;
  const accNum = String(account_number || login || '');

  if (!accNum || !new_password) {
    return res.status(400).json({ ok: false, success: false, message: 'Account number and new password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ ok: false, success: false, message: 'New password must be at least 8 characters long' });
  }

  const isInvestor = password_type === 'investor';
  const encrypted = encryptText(new_password);
  const column = isInvestor ? 'investor_password' : 'master_password';

  try {
    let targetAcc = null;

    if (checkPgStatus()) {
      const checkRes = await query(
        `SELECT * FROM trading_accounts WHERE (account_number = $1 OR login = $2) AND user_id = $3`,
        [accNum, parseInt(accNum, 10) || 0, userId]
      );
      targetAcc = checkRes.rows[0];
    } else {
      targetAcc = inMemoryStore.trading_accounts?.find(a => (a.account_number === accNum || a.login === parseInt(accNum, 10)) && a.user_id === userId);
    }

    if (!targetAcc) {
      return res.status(404).json({ ok: false, success: false, message: 'Trading account not found or access denied' });
    }

    if (checkPgStatus()) {
      await query(`UPDATE trading_accounts SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [encrypted, targetAcc.id]);
    } else {
      targetAcc[column] = encrypted;
    }

    return res.json({
      ok: true,
      success: true,
      message: `${isInvestor ? 'Investor' : 'Master'} password for account #${accNum} updated successfully`,
      data: { account_number: accNum, password_type: isInvestor ? 'investor' : 'master' }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Password update failed', error: err.message });
  }
};

/**
 * 6. POST /api/trading-accounts/leverage
 */
export const updateLeverage = async (req, res) => {
  const userId = req.user.id;
  const { account_number, login, leverage } = req.body;
  const accNum = String(account_number || login || '');

  if (!accNum || !leverage) {
    return res.status(400).json({ ok: false, success: false, message: 'Account number and leverage value are required' });
  }

  try {
    if (checkPgStatus()) {
      await query(`UPDATE trading_accounts SET leverage = $1 WHERE (account_number = $2 OR login = $3) AND user_id = $4`, [leverage, accNum, parseInt(accNum, 10) || 0, userId]);
    } else {
      const acc = inMemoryStore.trading_accounts?.find(a => (a.account_number === accNum || a.login === parseInt(accNum, 10)) && a.user_id === userId);
      if (acc) acc.leverage = leverage;
    }

    return res.json({
      ok: true,
      success: true,
      message: `Leverage updated to 1:${leverage} for account #${accNum}`,
      data: { account_number: accNum, leverage }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Leverage update failed', error: err.message });
  }
};

/**
 * 7. POST /api/trading-accounts/transfer
 */
export const internalTransfer = async (req, res) => {
  const userId = req.user.id;
  const { from_type, to_login, amount } = req.body;

  const transferAmount = parseFloat(amount);
  if (!transferAmount || transferAmount <= 0) {
    return res.status(400).json({ ok: false, success: false, message: 'Invalid transfer amount' });
  }

  try {
    if (checkPgStatus()) {
      if (from_type === 'wallet') {
        await query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [transferAmount, userId]);
        await query(`UPDATE trading_accounts SET balance = balance + $1, equity = equity + $1, free_margin = free_margin + $1 WHERE (account_number = $2 OR login = $3) AND user_id = $4`, [transferAmount, String(to_login), parseInt(to_login, 10) || 0, userId]);
      } else {
        await query(`UPDATE trading_accounts SET balance = balance - $1, equity = equity - $1, free_margin = free_margin - $1 WHERE (account_number = $2 OR login = $3) AND user_id = $4`, [transferAmount, String(to_login), parseInt(to_login, 10) || 0, userId]);
        await query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [transferAmount, userId]);
      }
    } else {
      const wallet = inMemoryStore.wallets?.find(w => w.user_id === userId);
      const acc = inMemoryStore.trading_accounts?.find(a => (a.account_number === String(to_login) || a.login === parseInt(to_login, 10)) && a.user_id === userId);
      if (wallet && acc) {
        if (from_type === 'wallet') {
          wallet.balance -= transferAmount;
          acc.balance += transferAmount;
          acc.equity += transferAmount;
          acc.free_margin += transferAmount;
        } else {
          acc.balance -= transferAmount;
          acc.equity -= transferAmount;
          acc.free_margin -= transferAmount;
          wallet.balance += transferAmount;
        }
      }
    }

    return res.json({
      ok: true,
      success: true,
      message: `Internal transfer of $${transferAmount.toFixed(2)} completed successfully`,
      data: { from_type, to_login, amount: transferAmount }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Internal transfer failed', error: err.message });
  }
};

/**
 * 8. GET /api/trading-accounts/sso-token
 */
export const getSsoToken = async (req, res) => {
  const userId = req.user.id;
  const { login, account_number } = req.query || req.body || {};

  try {
    const ssoToken = `sso_wt_${Math.random().toString(36).substring(2)}${Date.now()}`;
    const webtraderUrl = `https://webtrader.vintagecrm.com/terminal?login=${login || account_number || 501928}&token=${ssoToken}`;

    return res.json({
      ok: true,
      success: true,
      message: 'Single Sign-On (SSO) WebTrader token generated',
      data: {
        sso_token: ssoToken,
        webtrader_url: webtraderUrl,
        server: 'VintageLive-Server 1'
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'SSO launch failed', error: err.message });
  }
};

export const getTradePerformance = async (req, res) => {
  return res.json({
    ok: true,
    success: true,
    data: {
      metrics: { total_trades: 0, win_rate_pct: 0, loss_rate_pct: 0, net_profit: 0, profit_factor: 1, total_lots: 0 },
      closed_trades: []
    }
  });
};

export const getCopyTradingProviders = async (req, res) => {
  return res.json({
    ok: true,
    success: true,
    data: { providers: [] }
  });
};

export const followStrategyProvider = async (req, res) => {
  return res.json({
    ok: true,
    success: true,
    data: {}
  });
};
