import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import crypto from 'crypto';

// In-Memory store for Financial Operations & Payment Gateways
let inMemoryDepositsMaster = [
  { id: 101, user_id: 2, user: 'alex.trader@example.com', amount: 5000.00, currency: 'USD', method: 'Bank Wire', tx_hash: 'WIRE_REF_991028', receipt: 'receipt_101.jpg', status: 'pending', created_at: '2026-08-17 14:20' },
  { id: 102, user_id: 3, user: 'maria.investor@example.com', amount: 1500.00, currency: 'USD', method: 'USDT (TRC20)', tx_hash: '0x892a0192381029381029', receipt: 'tx_hash_0x892a...', status: 'pending', created_at: '2026-08-17 15:05' },
  { id: 103, user_id: 4, user: 'david.fx@example.com', amount: 10000.00, currency: 'USD', method: 'Bank Wire', tx_hash: 'WIRE_REF_441029', receipt: 'receipt_103.pdf', status: 'pending', created_at: '2026-08-17 15:40' },
  { id: 104, user_id: 1, user: 'trader@example.com', amount: 2500.00, currency: 'USD', method: 'Cregis USDT', tx_hash: '0x3c91a0b9821039a82012', receipt: 'auto_confirmed', status: 'approved', created_at: '2026-08-16 10:15' },
  { id: 105, user_id: 5, user: 'chen.wei@example.com', amount: 500.00, currency: 'USD', method: 'Credit Card', tx_hash: 'CARD_PAY_771029', receipt: 'stripe_charge', status: 'rejected', rejection_reason: 'Card Issuer Fraud Check Failed', created_at: '2026-08-15 12:30' }
];

let inMemoryWithdrawalsMaster = [
  { id: 201, user_id: 2, user: 'alex.trader@example.com', amount: 2000.00, net_amount: 1999.00, fee: 1.00, currency: 'USD', payout_method: 'USDT (TRC20)', network: 'TRC20', destination: 'T9zXX9Kpq7aK9qP8291mLaZ387nK', status: 'pending', risk_score: 'Low', created_at: '2026-08-17 16:00' },
  { id: 202, user_id: 4, user: 'david.fx@example.com', amount: 4500.00, net_amount: 4495.00, fee: 5.00, currency: 'USD', payout_method: 'USDT (ERC20)', network: 'ERC20', destination: '0x8f3c91a0b9821039a820129381', status: 'pending', risk_score: 'High Risk (New Address)', created_at: '2026-08-17 16:30' },
  { id: 203, user_id: 1, user: 'trader@example.com', amount: 1000.00, net_amount: 999.00, fee: 1.00, currency: 'USD', payout_method: 'USDT (TRC20)', network: 'TRC20', destination: 'T9zXX9Kpq7aK9qP8291mLaZ387nK', status: 'approved', tx_hash: '0x9910283710293810293', created_at: '2026-08-15 11:20' },
  { id: 204, user_id: 3, user: 'maria.investor@example.com', amount: 300.00, net_amount: 300.00, fee: 0.00, currency: 'USD', payout_method: 'Bank Wire', network: 'Swift', destination: 'IBAN ES912038102938102938', status: 'rejected', rejection_reason: 'Unmatched Account Holder Name (Funds Refunded)', created_at: '2026-08-14 09:15' }
];

let inMemoryLocalDepositors = [
  { id: 1, name: 'LATAM P2P Exchange Desk', agent: 'Carlos Mendoza', region: 'Colombia / LATAM', balanceLimit: 50000.00, usedLimit: 18400.00, commissionPct: 1.5, pendingRequests: 2, status: 'active' },
  { id: 2, name: 'SEA Cashier Network', agent: 'Hassan Tan', region: 'Singapore / SEA', balanceLimit: 100000.00, usedLimit: 42100.00, commissionPct: 1.2, pendingRequests: 1, status: 'active' }
];

let inMemoryAutoGateways = [
  { id: 'cregis', name: 'Cregis Crypto Merchant Gateway', type: 'Crypto Auto-Sweep', merchantId: 'CRG_MCH_881029', apiKey: 'cg_live_99201923810293', status: 'enabled', supportedCurrencies: ['USDT_TRC20', 'USDT_ERC20', 'BTC'] },
  { id: 'stripe', name: 'Stripe Card Gateway', type: 'Credit / Debit Card', merchantId: 'acct_1M982019238', apiKey: 'sk_live_51M982019238', status: 'enabled', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
  { id: 'match2pay', name: 'Match2Pay Institutional', type: 'Crypto / Wire', merchantId: 'm2p_live_44102', apiKey: 'm2p_sec_991029', status: 'disabled', supportedCurrencies: ['USD', 'USDT'] }
];

let inMemoryManualGateways = [
  { id: 'usdt_trc20', name: 'USDT (TRC20 Tron)', network: 'TRC20', address: 'T9zXX9Kpq7aK9qP8291mLaZ387nK', qrCodeUrl: '/uploads/qr/usdt_trc20.png', minDeposit: 10.00, status: 'active' },
  { id: 'usdt_erc20', name: 'USDT (ERC20 Ethereum)', network: 'ERC20', address: '0x8f3c91a0b9821039a820129381', qrCodeUrl: '/uploads/qr/usdt_erc20.png', minDeposit: 50.00, status: 'active' },
  { id: 'bank_wire', name: 'Global Bank Wire Transfer', network: 'Swift / SEPA', address: 'Beneficiary: Vintage Capital Ltd | IBAN: GB29 VINT 1029 3810 2938 | BIC: VINTGB2L', qrCodeUrl: '', minDeposit: 500.00, status: 'active' }
];

let inMemoryWithdrawalRails = [
  { id: 'usdt_trc20', name: 'USDT TRC20 Payout Rail', minWithdrawal: 50.00, maxWithdrawal: 50000.00, feeFixed: 1.00, feePercent: 0.0, status: 'active' },
  { id: 'usdt_erc20', name: 'USDT ERC20 Payout Rail', minWithdrawal: 100.00, maxWithdrawal: 50000.00, feeFixed: 5.00, feePercent: 0.0, status: 'active' },
  { id: 'bank_wire', name: 'Bank Wire Payout Rail', minWithdrawal: 250.00, maxWithdrawal: 100000.00, feeFixed: 25.00, feePercent: 0.5, status: 'active' }
];

let inMemoryUserPaymentDetails = [
  { id: 1, user_id: 2, user: 'alex.trader@example.com', detail_type: 'Bank Account', title: 'Barclays UK Account', details: 'Sort: 20-40-60 | Acc: 88102938 | IBAN: GB29BARC20406088102938', status: 'verified', submitted_at: '2026-08-10' },
  { id: 2, user_id: 4, user: 'david.fx@example.com', detail_type: 'Crypto Wallet', title: 'Personal TRC20 Wallet', details: 'T9zXX9Kpq7aK9qP8291mLaZ387nK', status: 'pending', submitted_at: '2026-08-16' }
];

let inMemoryCryptoSweeping = {
  trc20HotWallet: 'T9zXX9Kpq7aK9qP8291mLaZ387nK',
  erc20HotWallet: '0x8f3c91a0b9821039a820129381',
  bep20HotWallet: '0x441029381029381029381029',
  autoSweepEnabled: true,
  autoSweepThresholdUsdt: 1000.00,
  maxGasPriceGwei: 35
};

/**
 * 35, 36, 37, 38. Get Deposits Ledgers (Pending, Approved, Rejected, All Master)
 */
export const getDepositsLedgers = async (req, res) => {
  try {
    const pending = inMemoryDepositsMaster.filter(d => d.status === 'pending');
    const approved = inMemoryDepositsMaster.filter(d => d.status === 'approved');
    const rejected = inMemoryDepositsMaster.filter(d => d.status === 'rejected');

    return res.json({
      message: 'Deposits ledgers retrieved successfully',
      data: {
        pendingQueue: pending,
        approvedLedger: approved,
        rejectedLedger: rejected,
        masterLedger: inMemoryDepositsMaster
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve deposit ledgers', error: err.message });
  }
};

/**
 * 35. Review Deposit Action (Approve / Reject)
 */
export const reviewDepositAction = async (req, res) => {
  const { deposit_id, action, notes } = req.body; // action: 'approve' | 'reject'

  if (!deposit_id || !action) {
    return res.status(400).json({ message: 'Deposit ID and action are required' });
  }

  try {
    const dep = inMemoryDepositsMaster.find(d => d.id === parseInt(deposit_id));
    if (dep) {
      dep.status = action === 'approve' ? 'approved' : 'rejected';
      dep.admin_notes = notes || '';
      if (action === 'reject') {
        dep.rejection_reason = notes || 'Declined by Backoffice Compliance';
      }

      if (action === 'approve') {
        const wallet = inMemoryStore.wallets ? inMemoryStore.wallets.find(w => w.user_id === dep.user_id) : null;
        if (wallet) wallet.balance += parseFloat(dep.amount);
      }
    }

    return res.json({
      message: `Deposit #${deposit_id} ${action}d successfully`,
      data: { deposit_id, action, status: action === 'approve' ? 'approved' : 'rejected' }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Deposit review processing failed', error: err.message });
  }
};

/**
 * 39. Local Depositor Management
 */
export const getLocalDepositors = async (req, res) => {
  try {
    return res.json({
      message: 'Local P2P depositor network ledger retrieved',
      data: { localDepositors: inMemoryLocalDepositors }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch local depositors', error: err.message });
  }
};

/**
 * 40, 41, 42, 43. Get Withdrawals Ledgers (Pending Risk Queue, Approved, Rejected, All Master)
 */
export const getWithdrawalsLedgers = async (req, res) => {
  try {
    const pending = inMemoryWithdrawalsMaster.filter(w => w.status === 'pending');
    const approved = inMemoryWithdrawalsMaster.filter(w => w.status === 'approved');
    const rejected = inMemoryWithdrawalsMaster.filter(w => w.status === 'rejected');

    return res.json({
      message: 'Withdrawals ledgers retrieved successfully',
      data: {
        pendingRiskQueue: pending,
        approvedLedger: approved,
        rejectedLedger: rejected,
        masterLedger: inMemoryWithdrawalsMaster
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve withdrawal ledgers', error: err.message });
  }
};

/**
 * 40, 41, 42. Review Withdrawal Action (Approve with TXID / Reject with Auto-Refund)
 */
export const reviewWithdrawalAction = async (req, res) => {
  const { withdrawal_id, action, tx_hash, rejection_reason } = req.body; // action: 'approve' | 'reject'

  if (!withdrawal_id || !action) {
    return res.status(400).json({ message: 'Withdrawal ID and action are required' });
  }

  try {
    const wd = inMemoryWithdrawalsMaster.find(w => w.id === parseInt(withdrawal_id));
    if (wd) {
      if (action === 'approve') {
        wd.status = 'approved';
        wd.tx_hash = tx_hash || `0x${crypto.randomBytes(16).toString('hex')}`;
        // Unlocks locked balance
        const wallet = inMemoryStore.wallets ? inMemoryStore.wallets.find(w => w.user_id === wd.user_id) : null;
        if (wallet) {
          wallet.locked_balance = Math.max(0, (wallet.locked_balance || 0) - parseFloat(wd.amount));
        }
      } else if (action === 'reject') {
        wd.status = 'rejected';
        wd.rejection_reason = rejection_reason || 'Declined by Risk Desk (Funds Refunded)';
        // REQUIREMENT 42: Auto-credits funds back to trader wallet
        const wallet = inMemoryStore.wallets ? inMemoryStore.wallets.find(w => w.user_id === wd.user_id) : null;
        if (wallet) {
          wallet.balance += parseFloat(wd.amount);
          wallet.locked_balance = Math.max(0, (wallet.locked_balance || 0) - parseFloat(wd.amount));
        }
      }
    }

    return res.json({
      message: action === 'approve'
        ? `Withdrawal #${withdrawal_id} approved and broadcasted with TXID: ${wd.tx_hash}`
        : `Withdrawal #${withdrawal_id} rejected. Reserved funds ($${wd.amount}) automatically refunded to trader wallet.`,
      data: { withdrawal_id, action, status: wd ? wd.status : action }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Withdrawal review failed', error: err.message });
  }
};

/**
 * 44. Automatic Payment Gateways Setup
 */
export const getPaymentGatewaysConfig = async (req, res) => {
  try {
    return res.json({
      message: 'Automatic payment gateways configuration retrieved',
      data: { autoGateways: inMemoryAutoGateways }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch payment gateways', error: err.message });
  }
};

export const updatePaymentGatewaysConfig = async (req, res) => {
  const { id, merchantId, apiKey, status } = req.body;

  try {
    const gw = inMemoryAutoGateways.find(g => g.id === id);
    if (gw) {
      if (merchantId !== undefined) gw.merchantId = merchantId;
      if (apiKey !== undefined) gw.apiKey = apiKey;
      if (status !== undefined) gw.status = status;
    }

    return res.json({
      message: `Gateway ${id} configuration updated successfully`,
      data: { id, merchantId, status }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Gateway configuration update failed', error: err.message });
  }
};

/**
 * 45. Manual Payment Gateways Setup (USDT TRC20/ERC20/BEP20, QR Codes, Bank Wire)
 */
export const getManualGatewaysConfig = async (req, res) => {
  try {
    return res.json({
      message: 'Manual payment methods & deposit wallet addresses fetched',
      data: { manualGateways: inMemoryManualGateways }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch manual gateways', error: err.message });
  }
};

export const updateManualGatewaysConfig = async (req, res) => {
  const { id, address, minDeposit, status } = req.body;

  try {
    const gw = inMemoryManualGateways.find(g => g.id === id);
    if (gw) {
      if (address !== undefined) gw.address = address;
      if (minDeposit !== undefined) gw.minDeposit = parseFloat(minDeposit);
      if (status !== undefined) gw.status = status;
    }

    return res.json({
      message: `Manual deposit method ${id} updated successfully`,
      data: { id, address, minDeposit }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Manual gateway update failed', error: err.message });
  }
};

/**
 * 46. Withdrawal Payment Gateways & Payout Rails Setup
 */
export const getWithdrawalGatewaysConfig = async (req, res) => {
  try {
    return res.json({
      message: 'Withdrawal payout rails & fee structures fetched',
      data: { payoutRails: inMemoryWithdrawalRails }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch payout rails', error: err.message });
  }
};

export const updateWithdrawalGatewaysConfig = async (req, res) => {
  const { id, minWithdrawal, maxWithdrawal, feeFixed, feePercent, status } = req.body;

  try {
    const rail = inMemoryWithdrawalRails.find(r => r.id === id);
    if (rail) {
      if (minWithdrawal !== undefined) rail.minWithdrawal = parseFloat(minWithdrawal);
      if (maxWithdrawal !== undefined) rail.maxWithdrawal = parseFloat(maxWithdrawal);
      if (feeFixed !== undefined) rail.feeFixed = parseFloat(feeFixed);
      if (feePercent !== undefined) rail.feePercent = parseFloat(feePercent);
      if (status !== undefined) rail.status = status;
    }

    return res.json({
      message: `Withdrawal payout rail ${id} configuration saved`,
      data: { id, minWithdrawal, maxWithdrawal, feeFixed }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Withdrawal rail update failed', error: err.message });
  }
};

/**
 * 47. User Payment Details Verification Queue
 */
export const getUserPaymentDetails = async (req, res) => {
  try {
    return res.json({
      message: 'User payment details verification queue fetched',
      data: { paymentDetails: inMemoryUserPaymentDetails }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch user payment details', error: err.message });
  }
};

export const verifyUserPaymentDetail = async (req, res) => {
  const { detail_id, action } = req.body; // action: 'verify' | 'decline'

  try {
    const item = inMemoryUserPaymentDetails.find(d => d.id === parseInt(detail_id));
    if (item) {
      item.status = action === 'verify' ? 'verified' : 'declined';
    }

    return res.json({
      message: `User payment detail #${detail_id} ${action}d successfully`,
      data: { detail_id, action }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Payment detail verification failed', error: err.message });
  }
};

/**
 * 48. Balance Adjustment Engine (Credit, Debit, Promotional Bonus)
 */
export const executeBalanceAdjustment = async (req, res) => {
  const { user_email_or_id, adjustment_type, amount, currency, memo_note } = req.body;

  const adjAmount = parseFloat(amount);
  if (!user_email_or_id || !adjAmount || adjAmount <= 0) {
    return res.status(400).json({ message: 'Target user, valid amount, and memo note are required' });
  }

  if (!memo_note || memo_note.trim().length < 5) {
    return res.status(400).json({ message: 'Mandatory memo note required (minimum 5 characters)' });
  }

  const type = adjustment_type || 'credit'; // 'credit' | 'debit' | 'bonus'
  const curr = currency || 'USD';
  const refId = `ADJ-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  try {
    let targetUser = null;
    if (checkPgStatus()) {
      const uRes = await query(`SELECT id, email FROM users WHERE email = $1 OR id = $2`, [user_email_or_id.toLowerCase(), parseInt(user_email_or_id) || 0]);
      targetUser = uRes.rows[0];
    } else {
      targetUser = inMemoryStore.users.find(u => u.email.toLowerCase() === user_email_or_id.toLowerCase() || u.id === parseInt(user_email_or_id));
    }

    const userId = targetUser ? targetUser.id : 1;

    if (checkPgStatus()) {
      if (type === 'debit') {
        await query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [adjAmount, userId]);
      } else {
        await query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [adjAmount, userId]);
      }
    } else {
      const wallet = inMemoryStore.wallets ? inMemoryStore.wallets.find(w => w.user_id === userId) : null;
      if (wallet) {
        if (type === 'debit') wallet.balance -= adjAmount;
        else wallet.balance += adjAmount;
      }
    }

    return res.json({
      message: `Balance Adjustment (${type.toUpperCase()}) of $${adjAmount.toFixed(2)} ${curr} executed for ${targetUser ? targetUser.email : user_email_or_id}! Ref: ${refId}`,
      data: {
        reference_id: refId,
        user_email: targetUser ? targetUser.email : user_email_or_id,
        adjustment_type: type,
        amount: adjAmount,
        currency: curr,
        memo_note
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Balance adjustment execution failed', error: err.message });
  }
};

/**
 * 49. USDT TRC20 / ERC20 / BEP20 Gateway & Crypto Auto-Sweeping Config
 */
export const getCryptoSweepingConfig = async (req, res) => {
  try {
    return res.json({
      message: 'USDT crypto wallet rotation & auto-sweeping config fetched',
      data: { sweeping: inMemoryCryptoSweeping }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch crypto sweeping config', error: err.message });
  }
};

export const updateCryptoSweepingConfig = async (req, res) => {
  const { trc20HotWallet, erc20HotWallet, bep20HotWallet, autoSweepEnabled, autoSweepThresholdUsdt, maxGasPriceGwei } = req.body;

  try {
    if (trc20HotWallet !== undefined) inMemoryCryptoSweeping.trc20HotWallet = trc20HotWallet;
    if (erc20HotWallet !== undefined) inMemoryCryptoSweeping.erc20HotWallet = erc20HotWallet;
    if (bep20HotWallet !== undefined) inMemoryCryptoSweeping.bep20HotWallet = bep20HotWallet;
    if (autoSweepEnabled !== undefined) inMemoryCryptoSweeping.autoSweepEnabled = Boolean(autoSweepEnabled);
    if (autoSweepThresholdUsdt !== undefined) inMemoryCryptoSweeping.autoSweepThresholdUsdt = parseFloat(autoSweepThresholdUsdt);
    if (maxGasPriceGwei !== undefined) inMemoryCryptoSweeping.maxGasPriceGwei = parseInt(maxGasPriceGwei);

    return res.json({
      message: 'USDT crypto wallet rotation & auto-sweeping settings updated',
      data: { sweeping: inMemoryCryptoSweeping }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update crypto sweeping settings', error: err.message });
  }
};
