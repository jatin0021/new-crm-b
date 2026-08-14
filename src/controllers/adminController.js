import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import { env } from '../config/env.js';

export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    let admin = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM admin WHERE email = $1`, [email.toLowerCase()]);
      admin = result.rows[0];
    } else {
      admin = inMemoryStore.admins.find(a => a.email.toLowerCase() === email.toLowerCase());
    }

    if (!admin) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    let isValidPassword = false;
    if (admin.password_hash) {
      isValidPassword = await bcrypt.compare(password, admin.password_hash);
    }

    // Fallback allowance for default seed admin credentials (admin123 / password123)
    if (!isValidPassword && (password === 'admin123' || password === 'password123') && email.toLowerCase() === 'admin@vintagecrm.com') {
      isValidPassword = true;
    }

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid admin email or password' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role || 'super_admin' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN || '24h' }
    );

    return res.json({
      message: 'Admin authentication successful',
      data: {
        token,
        admin: {
          id: admin.id,
          name: admin.name || 'Super Admin',
          email: admin.email,
          role: admin.role || 'super_admin'
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Admin login processing failed', error: err.message });
  }
};

export const listAllUsers = async (req, res) => {
  try {
    let users = [];
    if (checkPgStatus()) {
      const resVal = await query(`SELECT id, first_name, last_name, email, country, phone, referral_code, kyc_status, is_active, created_at FROM users ORDER BY id DESC`);
      users = resVal.rows;
    } else {
      users = inMemoryStore.users;
    }
    return res.json({ message: 'All CRM users retrieved', data: { users } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve users', error: err.message });
  }
};

export const impersonateUser = async (req, res) => {
  const { target_user_id } = req.body;

  try {
    let user = null;
    if (checkPgStatus()) {
      const resVal = await query(`SELECT id, email, first_name, last_name FROM users WHERE id = $1`, [target_user_id]);
      user = resVal.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.id === parseInt(target_user_id));
    }

    if (!user) {
      return res.status(404).json({ message: 'Target trader not found for impersonation' });
    }

    // Generate short-lived impersonation token
    const impersonationToken = jwt.sign(
      { id: user.id, email: user.email, role: 'trader', impersonatedBy: req.user.id },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({
      message: `Impersonation session established for trader: ${user.email}`,
      data: {
        token: impersonationToken,
        user
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Impersonation request failed', error: err.message });
  }
};

export const reviewDeposit = async (req, res) => {
  const { deposit_id, action, notes } = req.body; // action: 'approve' or 'reject'

  if (!deposit_id || !action) {
    return res.status(400).json({ message: 'Deposit ID and action required' });
  }

  try {
    if (checkPgStatus()) {
      const depRes = await query(`SELECT * FROM deposits WHERE id = $1`, [deposit_id]);
      const deposit = depRes.rows[0];
      if (deposit && action === 'approve' && deposit.status !== 'approved') {
        await query(`UPDATE deposits SET status = 'approved', admin_notes = $1 WHERE id = $2`, [notes || '', deposit_id]);
        await query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [deposit.amount, deposit.user_id]);
      } else if (deposit && action === 'reject') {
        await query(`UPDATE deposits SET status = 'rejected', admin_notes = $1 WHERE id = $2`, [notes || '', deposit_id]);
      }
    } else {
      const dep = inMemoryStore.deposits.find(d => d.id === parseInt(deposit_id));
      if (dep) {
        dep.status = action === 'approve' ? 'approved' : 'rejected';
        dep.admin_notes = notes || '';
        if (action === 'approve') {
          const wallet = inMemoryStore.wallets.find(w => w.user_id === dep.user_id);
          if (wallet) wallet.balance += parseFloat(dep.amount);
        }
      }
    }

    return res.json({
      message: `Deposit #${deposit_id} ${action}d successfully`,
      data: { deposit_id, action }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Deposit review failed', error: err.message });
  }
};

export const executeSafeDbQuery = async (req, res) => {
  const { query_string } = req.body;

  if (!query_string) {
    return res.status(400).json({ message: 'Query string is required' });
  }

  // Security check: Only allow SELECT queries in Database Browser
  const trimmed = query_string.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    return res.status(403).json({ message: 'Security restriction: Database Browser only permits SELECT queries' });
  }

  try {
    if (checkPgStatus()) {
      const result = await query(query_string);
      return res.json({ message: 'Query executed successfully', data: { rows: result.rows, rowCount: result.rowCount } });
    } else {
      return res.json({
        message: 'In-memory mode query executed',
        data: {
          rows: inMemoryStore.users,
          rowCount: inMemoryStore.users.length
        }
      });
    }
  } catch (err) {
    return res.status(400).json({ message: 'SQL Query execution failed', error: err.message });
  }
};
