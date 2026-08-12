import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

export const listTradingAccounts = async (req, res) => {
  const userId = req.user.id;

  try {
    let accounts = [];
    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM trading_accounts WHERE user_id = $1 ORDER BY id DESC`, [userId]);
      accounts = result.rows;
    } else {
      accounts = inMemoryStore.trading_accounts.filter(a => a.user_id === userId);
    }

    return res.json({
      message: 'Trading accounts fetched successfully',
      data: { accounts }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve trading accounts', error: err.message });
  }
};

export const createTradingAccount = async (req, res) => {
  const userId = req.user.id;
  const { account_type, group_type, leverage } = req.body;

  const type = account_type === 'demo' ? 'demo' : 'live';
  const group = group_type || 'Standard ECN';
  const lev = leverage || '1:500';
  const loginNumber = Math.floor(500000 + Math.random() * 400000);
  const masterPass = `Mst#${Math.floor(100000 + Math.random() * 800000)}`;
  const investorPass = `Inv#${Math.floor(100000 + Math.random() * 800000)}`;
  const initialBalance = type === 'demo' ? 10000.00 : 0.00;

  try {
    let newAccount = null;

    if (checkPgStatus()) {
      const result = await query(
        `INSERT INTO trading_accounts (user_id, login, account_type, group_type, leverage, master_password, investor_password, balance, equity, free_margin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8) RETURNING *`,
        [userId, loginNumber, type, group, lev, masterPass, investorPass, initialBalance]
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
        currency: 'USD',
        created_at: new Date().toISOString()
      };
      inMemoryStore.trading_accounts.push(newAccount);
    }

    return res.status(201).json({
      message: `MT5 ${type.toUpperCase()} trading account created successfully`,
      data: { account: newAccount }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to provision MT5 trading account', error: err.message });
  }
};

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

export const internalTransfer = async (req, res) => {
  const userId = req.user.id;
  const { from_type, to_login, amount } = req.body; // from_type: 'wallet' -> MT5, or 'mt5' -> wallet

  const transferAmount = parseFloat(amount);
  if (!transferAmount || transferAmount <= 0) {
    return res.status(400).json({ message: 'Invalid transfer amount' });
  }

  try {
    if (checkPgStatus()) {
      if (from_type === 'wallet') {
        await query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [transferAmount, userId]);
        await query(`UPDATE trading_accounts SET balance = balance + $1, equity = equity + $1 WHERE login = $2 AND user_id = $3`, [transferAmount, to_login, userId]);
      } else {
        await query(`UPDATE trading_accounts SET balance = balance - $1, equity = equity - $1 WHERE login = $2 AND user_id = $3`, [transferAmount, to_login, userId]);
        await query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [transferAmount, userId]);
      }
    } else {
      const wallet = inMemoryStore.wallets.find(w => w.user_id === userId);
      const acc = inMemoryStore.trading_accounts.find(a => a.login === parseInt(to_login) && a.user_id === userId);
      if (wallet && acc) {
        if (from_type === 'wallet') {
          wallet.balance -= transferAmount;
          acc.balance += transferAmount;
          acc.equity += transferAmount;
        } else {
          acc.balance -= transferAmount;
          acc.equity -= transferAmount;
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
