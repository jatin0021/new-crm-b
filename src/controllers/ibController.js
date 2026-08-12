import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

export const getIbProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    let ib = null;
    let ledger = [];

    if (checkPgStatus()) {
      const ibRes = await query(`SELECT * FROM ib_profiles WHERE user_id = $1`, [userId]);
      ib = ibRes.rows[0];
      if (ib) {
        const ledgerRes = await query(`SELECT * FROM ib_commission_ledger WHERE ib_id = $1 ORDER BY id DESC LIMIT 20`, [ib.id]);
        ledger = ledgerRes.rows;
      }
    } else {
      ib = inMemoryStore.ib_profiles.find(i => i.user_id === userId);
      if (ib) {
        ledger = [
          { id: 1, symbol: 'EURUSD', lots: 2.5, commission_amount: 12.50, created_at: new Date().toISOString() },
          { id: 2, symbol: 'XAUUSD', lots: 5.0, commission_amount: 35.00, created_at: new Date().toISOString() }
        ];
      }
    }

    if (!ib) {
      // Auto-create IB profile if none exists
      const newIbCode = `IB-${Math.floor(1000 + Math.random() * 9000)}`;
      if (checkPgStatus()) {
        const createRes = await query(
          `INSERT INTO ib_profiles (user_id, ib_code, tier) VALUES ($1, $2, 'Master IB') RETURNING *`,
          [userId, newIbCode]
        );
        ib = createRes.rows[0];
      } else {
        ib = {
          id: inMemoryStore.ib_profiles.length + 1,
          user_id: userId,
          ib_code: newIbCode,
          tier: 'Master IB',
          total_clients: 0,
          total_lots: 0.00,
          commission_balance: 0.00,
          created_at: new Date().toISOString()
        };
        inMemoryStore.ib_profiles.push(ib);
      }
    }

    return res.json({
      message: 'IB partner profile retrieved successfully',
      data: { ib, ledger }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve IB profile', error: err.message });
  }
};
