import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

export const getWallet = async (req, res) => {
  const userId = req.user.id;
  try {
    let wallet = null;
    if (checkPgStatus()) {
      const resVal = await query(`SELECT * FROM wallets WHERE user_id = $1`, [userId]);
      wallet = resVal.rows[0];
    } else {
      wallet = inMemoryStore.wallets.find(w => w.user_id === userId);
    }
    return res.json({ message: 'Wallet balance retrieved', data: { wallet } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch wallet', error: err.message });
  }
};

export const listDeposits = async (req, res) => {
  const userId = req.user.id;
  try {
    let deposits = [];
    if (checkPgStatus()) {
      const resVal = await query(`SELECT * FROM deposits WHERE user_id = $1 ORDER BY id DESC`, [userId]);
      deposits = resVal.rows;
    } else {
      deposits = inMemoryStore.deposits.filter(d => d.user_id === userId);
    }
    return res.json({ message: 'Deposits history retrieved', data: { deposits } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch deposits', error: err.message });
  }
};

export const requestDeposit = async (req, res) => {
  const userId = req.user.id;
  const { amount, currency, gateway } = req.body;
  const proof_file = req.file ? req.file.filename : null;

  const depositAmount = parseFloat(amount);
  if (!depositAmount || depositAmount <= 0) {
    return res.status(400).json({ message: 'Valid deposit amount required' });
  }

  const selectedGateway = gateway || 'manual_wire';

  try {
    let newDeposit = null;

    if (checkPgStatus()) {
      const result = await query(
        `INSERT INTO deposits (user_id, amount, currency, gateway, proof_file, status)
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
        [userId, depositAmount, currency || 'USD', selectedGateway, proof_file]
      );
      newDeposit = result.rows[0];
    } else {
      newDeposit = {
        id: inMemoryStore.deposits.length + 500,
        user_id: userId,
        amount: depositAmount,
        currency: currency || 'USD',
        gateway: selectedGateway,
        status: 'pending',
        proof_file,
        created_at: new Date().toISOString()
      };
      inMemoryStore.deposits.push(newDeposit);
    }

    return res.status(201).json({
      message: 'Deposit request submitted successfully. Pending admin approval.',
      data: { deposit: newDeposit }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Deposit request failed', error: err.message });
  }
};

export const requestWithdrawal = async (req, res) => {
  const userId = req.user.id;
  const { amount, payout_method, destination_details } = req.body;

  const withdrawAmount = parseFloat(amount);
  if (!withdrawAmount || withdrawAmount <= 0 || !destination_details) {
    return res.status(400).json({ message: 'Amount and destination details are required' });
  }

  try {
    let newWithdrawal = null;

    if (checkPgStatus()) {
      // Freeze wallet balance
      await query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [withdrawAmount, userId]);
      const result = await query(
        `INSERT INTO withdrawals (user_id, amount, currency, payout_method, destination_details, status)
         VALUES ($1, $2, 'USD', $3, $4, 'pending') RETURNING *`,
        [userId, withdrawAmount, payout_method || 'crypto_usdt', destination_details]
      );
      newWithdrawal = result.rows[0];
    } else {
      const wallet = inMemoryStore.wallets.find(w => w.user_id === userId);
      if (wallet) wallet.balance -= withdrawAmount;

      newWithdrawal = {
        id: inMemoryStore.withdrawals.length + 700,
        user_id: userId,
        amount: withdrawAmount,
        currency: 'USD',
        payout_method: payout_method || 'crypto_usdt',
        destination_details,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      inMemoryStore.withdrawals.push(newWithdrawal);
    }

    return res.status(201).json({
      message: 'Withdrawal request submitted. Funds temporarily reserved for processing.',
      data: { withdrawal: newWithdrawal }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Withdrawal submission failed', error: err.message });
  }
};
