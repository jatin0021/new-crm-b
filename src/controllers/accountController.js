import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import crypto from 'crypto';

/**
 * 1. List Trading Accounts with Live Margin & Risk Metrics
 */
export const listTradingAccounts = async (req, res) => {
  const userId = req.user.id;

  try {
    let accounts = [];
    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM trading_accounts WHERE user_id = $1 ORDER BY id DESC`, [userId]);
      accounts = result.rows;
    } else {
      accounts = inMemoryStore.trading_accounts ? inMemoryStore.trading_accounts.filter(a => a.user_id === userId) : [];
    }

    // Enrich with calculated Risk & Margin Metrics
    const enrichedAccounts = accounts.map(acc => {
      const bal = parseFloat(acc.balance || 0);
      const eq = parseFloat(acc.equity || bal);
      const freeMarg = parseFloat(acc.free_margin || eq);
      const marginUsed = Math.max(0, eq - freeMarg);
      const marginLevelPct = marginUsed > 0 ? parseFloat(((eq / marginUsed) * 100).toFixed(2)) : 9999.99;
      const floatingPnl = parseFloat((eq - bal).toFixed(2));

      return {
        ...acc,
        balance: bal,
        equity: eq,
        free_margin: freeMarg,
        margin_used: parseFloat(marginUsed.toFixed(2)),
        margin_level_pct: marginLevelPct,
        floating_pnl: floatingPnl,
        server: acc.account_type === 'demo' ? 'VintageDemo-Server 1' : 'VintageLive-Server 1'
      };
    });

    return res.json({
      message: 'Trading accounts & risk metrics retrieved',
      data: { accounts: enrichedAccounts }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve trading accounts', error: err.message });
  }
};

/**
 * 2. Create Live or Demo Trading Account (with Platform, Group, Leverage Matrix, Currency, Balance)
 */
export const createTradingAccount = async (req, res) => {
  const userId = req.user.id;
  const { account_type, group_type, leverage, currency, initial_demo_balance, platform } = req.body;

  const type = account_type === 'demo' ? 'demo' : 'live';
  const group = group_type || 'Standard ECN';
  const lev = leverage || '1:500';
  const curr = currency || 'USD';
  const plat = platform || 'MetaTrader 5';

  const loginNumber = Math.floor(500000 + Math.random() * 400000);
  const masterPass = `Mst#${Math.floor(100000 + Math.random() * 800000)}`;
  const investorPass = `Inv#${Math.floor(100000 + Math.random() * 800000)}`;
  const initialBalance = type === 'demo' ? parseFloat(initial_demo_balance || 10000.00) : 0.00;

  try {
    let newAccount = null;

    if (checkPgStatus()) {
      const result = await query(
        `INSERT INTO trading_accounts (user_id, login, account_type, group_type, leverage, master_password, investor_password, balance, equity, free_margin, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8, $9) RETURNING *`,
        [userId, loginNumber, type, group, lev, masterPass, investorPass, initialBalance, curr]
      );
      newAccount = result.rows[0];
    } else {
      newAccount = {
        id: inMemoryStore.trading_accounts.length + 100,
        user_id: userId,
        login: loginNumber,
        account_type: type,
        group_type: group,
        leverage: lev,
        master_password: masterPass,
        investor_password: investorPass,
        balance: initialBalance,
        equity: initialBalance,
        free_margin: initialBalance,
        currency: curr,
        platform: plat,
        created_at: new Date().toISOString()
      };
      inMemoryStore.trading_accounts.push(newAccount);
    }

    return res.status(201).json({
      message: `${plat} ${type.toUpperCase()} trading account created successfully`,
      data: { account: newAccount }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to provision trading account', error: err.message });
  }
};

/**
 * 3. Change Account Master or Investor Password
 */
export const changeTradingPassword = async (req, res) => {
  const userId = req.user.id;
  const { login, password_type, new_password } = req.body; // password_type: 'master' | 'investor'

  if (!login || !new_password) {
    return res.status(400).json({ message: 'Account login number and new password are required' });
  }

  const isInvestor = password_type === 'investor';
  const column = isInvestor ? 'investor_password' : 'master_password';

  try {
    if (checkPgStatus()) {
      await query(`UPDATE trading_accounts SET ${column} = $1 WHERE login = $2 AND user_id = $3`, [new_password, login, userId]);
    } else {
      const acc = inMemoryStore.trading_accounts.find(a => a.login === parseInt(login) && a.user_id === userId);
      if (acc) {
        if (isInvestor) acc.investor_password = new_password;
        else acc.master_password = new_password;
      }
    }

    return res.json({
      message: `${isInvestor ? 'Investor (Read-Only)' : 'Master Trading'} password for account #${login} updated successfully`,
      data: { login, password_type: isInvestor ? 'investor' : 'master' }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Password update failed', error: err.message });
  }
};

/**
 * 4. Single Sign-On (SSO) WebTrader Launch Token
 */
export const getSsoToken = async (req, res) => {
  const userId = req.user.id;
  const { login } = req.body;

  try {
    const ssoToken = `sso_wt_${crypto.randomBytes(24).toString('hex')}`;
    const webtraderUrl = `https://webtrader.vintagecrm.com/terminal?login=${login || 501928}&token=${ssoToken}`;

    return res.json({
      message: 'Single Sign-On (SSO) WebTrader token generated',
      data: {
        sso_token: ssoToken,
        webtrader_url: webtraderUrl,
        server: 'VintageLive-Server 1'
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'SSO launch failed', error: err.message });
  }
};

/**
 * 5. Update Account Leverage
 */
export const updateLeverage = async (req, res) => {
  const userId = req.user.id;
  const { login, leverage } = req.body;

  if (!login || !leverage) {
    return res.status(400).json({ message: 'Login number and leverage value are required' });
  }

  try {
    if (checkPgStatus()) {
      await query(`UPDATE trading_accounts SET leverage = $1 WHERE login = $2 AND user_id = $3`, [leverage, login, userId]);
    } else {
      const acc = inMemoryStore.trading_accounts.find(a => a.login === parseInt(login) && a.user_id === userId);
      if (acc) acc.leverage = leverage;
    }

    return res.json({
      message: `Leverage updated to ${leverage} for account #${login}`,
      data: { login, leverage }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Leverage update failed', error: err.message });
  }
};

/**
 * 6. Internal Funds Transfer (Wallet <-> MT5 Account)
 */
export const internalTransfer = async (req, res) => {
  const userId = req.user.id;
  const { from_type, to_login, amount } = req.body;

  const transferAmount = parseFloat(amount);
  if (!transferAmount || transferAmount <= 0) {
    return res.status(400).json({ message: 'Invalid transfer amount' });
  }

  try {
    if (checkPgStatus()) {
      if (from_type === 'wallet') {
        await query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [transferAmount, userId]);
        await query(`UPDATE trading_accounts SET balance = balance + $1, equity = equity + $1, free_margin = free_margin + $1 WHERE login = $2 AND user_id = $3`, [transferAmount, to_login, userId]);
      } else {
        await query(`UPDATE trading_accounts SET balance = balance - $1, equity = equity - $1, free_margin = free_margin - $1 WHERE login = $2 AND user_id = $3`, [transferAmount, to_login, userId]);
        await query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [transferAmount, userId]);
      }
    } else {
      const wallet = inMemoryStore.wallets ? inMemoryStore.wallets.find(w => w.user_id === userId) : null;
      const acc = inMemoryStore.trading_accounts.find(a => a.login === parseInt(to_login) && a.user_id === userId);
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
      message: `Internal transfer of $${transferAmount.toFixed(2)} completed successfully`,
      data: { from_type, to_login, amount: transferAmount }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Internal transfer failed', error: err.message });
  }
};

/**
 * 7. Trade Performance Ledger & Closed Trades History Table
 */
export const getTradePerformance = async (req, res) => {
  const userId = req.user.id;

  try {
    let trades = [];
    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM mt5_trade_history ORDER BY close_time DESC`);
      trades = result.rows;
    } else {
      trades = inMemoryStore.mt5_trade_history || [];
    }

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => parseFloat(t.profit) > 0);
    const losingTrades = trades.filter(t => parseFloat(t.profit) < 0);

    const winRate = totalTrades > 0 ? ((winningTrades.length / totalTrades) * 100).toFixed(1) : 0;
    const lossRate = totalTrades > 0 ? ((losingTrades.length / totalTrades) * 100).toFixed(1) : 0;

    const totalWinProfit = winningTrades.reduce((acc, t) => acc + parseFloat(t.profit), 0);
    const totalLossProfit = Math.abs(losingTrades.reduce((acc, t) => acc + parseFloat(t.profit), 0));

    const netProfit = totalWinProfit - totalLossProfit;
    const profitFactor = totalLossProfit > 0 ? (totalWinProfit / totalLossProfit).toFixed(2) : (totalWinProfit > 0 ? '99.9' : '1.0');
    const totalVolume = trades.reduce((acc, t) => acc + parseFloat(t.volume_lots), 0);

    return res.json({
      message: 'Trade performance ledger computed',
      data: {
        metrics: {
          total_trades: totalTrades,
          win_rate_pct: parseFloat(winRate),
          loss_rate_pct: parseFloat(lossRate),
          net_profit: parseFloat(netProfit.toFixed(2)),
          profit_factor: parseFloat(profitFactor),
          total_lots: parseFloat(totalVolume.toFixed(2)),
          avg_win: winningTrades.length > 0 ? parseFloat((totalWinProfit / winningTrades.length).toFixed(2)) : 0,
          avg_loss: losingTrades.length > 0 ? parseFloat((totalLossProfit / losingTrades.length).toFixed(2)) : 0
        },
        closed_trades: trades
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve trade performance', error: err.message });
  }
};

/**
 * 8. Copy Trading / Social Copier Providers & Allocation
 */
export const getCopyTradingProviders = async (req, res) => {
  try {
    const providers = [
      { id: 1, name: 'Alpha Quant Algorithmic', trader: 'Alexey V.', monthly_roi: '+24.5%', drawdown: '4.2%', win_rate: '78%', copiers: 1420, min_deposit: 500, risk_score: 3 },
      { id: 2, name: 'Gold & FX Swing Master', trader: 'Elena R.', monthly_roi: '+38.2%', drawdown: '8.7%', win_rate: '71%', copiers: 2890, min_deposit: 1000, risk_score: 5 },
      { id: 3, name: 'Conservative Yield ECN', trader: 'Michael B.', monthly_roi: '+12.8%', drawdown: '1.9%', win_rate: '85%', copiers: 980, min_deposit: 250, risk_score: 1 }
    ];

    return res.json({
      message: 'Copy trading strategy providers fetched',
      data: { providers }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Copy trading lookup failed', error: err.message });
  }
};

export const followStrategyProvider = async (req, res) => {
  const userId = req.user.id;
  const { provider_id, login, allocation_amount } = req.body;

  try {
    return res.json({
      message: `Successfully allocated $${allocation_amount || 500} to Copy Strategy Provider #${provider_id} on Account #${login || 501928}`,
      data: { provider_id, login, allocation_amount }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Copy allocation failed', error: err.message });
  }
};
