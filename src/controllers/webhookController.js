import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

export const handleCregisWebhook = async (req, res) => {
  const { event, trade_id, status, amount, user_id } = req.body;
  console.log('🔔 Cregis Crypto Webhook Received:', req.body);

  if (status === 'SUCCESS' || status === 'CONFIRMED') {
    try {
      const depositAmount = parseFloat(amount || 0);
      const targetUser = parseInt(user_id || 1);

      if (checkPgStatus()) {
        await query(
          `INSERT INTO deposits (user_id, amount, currency, gateway, status, tx_hash)
           VALUES ($1, $2, 'USDT', 'cregis_crypto', 'approved', $3)`,
          [targetUser, depositAmount, trade_id || 'cregis_tx_auto']
        );
        await query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [depositAmount, targetUser]);
      } else {
        const wallet = inMemoryStore.wallets.find(w => w.user_id === targetUser);
        if (wallet) wallet.balance += depositAmount;
      }
    } catch (err) {
      console.error('Cregis webhook processing error:', err);
    }
  }

  return res.status(200).json({ code: 'SUCCESS', message: 'Cregis webhook processed' });
};

export const handleJexipayWebhook = async (req, res) => {
  console.log('🔔 Jexipay Fiat Payment Webhook Received:', req.body);
  return res.status(200).json({ status: 'OK', message: 'Jexipay webhook processed' });
};

export const handleShuftiKycWebhook = async (req, res) => {
  console.log('🔔 Shufti Pro AI KYC Webhook Received:', req.body);
  const { reference, event } = req.body;

  if (event === 'verification.accepted') {
    try {
      if (checkPgStatus()) {
        await query(`UPDATE users SET kyc_status = 'verified' WHERE email = $1`, [reference]);
      }
    } catch (err) {
      console.error('Shufti webhook error:', err);
    }
  }

  return res.status(200).json({ status: 'SUCCESS' });
};
