import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import { env } from '../config/env.js';

export const registerUser = async (req, res) => {
  const { first_name, last_name, email, password, country, phone, referral_code } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({
      message: 'First name, last name, email, and password are required'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const assignedRefCode = referral_code ? referral_code.trim().toUpperCase() : `REF${Math.floor(1000 + Math.random() * 9000)}`;

    let newUser = null;

    if (checkPgStatus()) {
      // Check existing email in Postgres
      const existingUser = await query(`SELECT id FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);
      if (existingUser.rows && existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const result = await query(
        `INSERT INTO users (first_name, last_name, email, password_hash, country, phone, referral_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, first_name, last_name, email, country, phone, referral_code, kyc_status, is_active, created_at`,
        [first_name.trim(), last_name.trim(), normalizedEmail, passwordHash, country || 'United States', phone || '', assignedRefCode]
      );
      newUser = result.rows[0];

      // Auto-create wallet
      const walletNum = `W-${Math.floor(10000 + Math.random() * 90000)}`;
      await query(
        `INSERT INTO wallets (user_id, wallet_number, balance) VALUES ($1, $2, 0.00)`,
        [newUser.id, walletNum]
      );
    } else {
      // Check existing email in memory
      const existing = inMemoryStore.users.find(u => u.email === normalizedEmail);
      if (existing) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      newUser = {
        id: inMemoryStore.users.length + 100,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        country: country || 'United States',
        phone: phone || '',
        referral_code: assignedRefCode,
        kyc_status: 'unverified',
        is_active: true,
        created_at: new Date().toISOString()
      };
      inMemoryStore.users.push(newUser);

      inMemoryStore.wallets.push({
        id: inMemoryStore.wallets.length + 1,
        user_id: newUser.id,
        wallet_number: `W-${Math.floor(10000 + Math.random() * 90000)}`,
        balance: 0.00,
        currency: 'USD'
      });
    }

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: 'trader' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'User registration successful',
      data: {
        token,
        user: {
          id: newUser.id,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          email: newUser.email,
          country: newUser.country,
          referral_code: newUser.referral_code,
          kyc_status: newUser.kyc_status
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, phone, identifier, password } = req.body;
  const loginInput = (identifier || email || phone || '').trim();

  if (!loginInput || !password) {
    return res.status(400).json({ message: 'Email or phone number and password are required' });
  }

  try {
    let user = null;

    if (checkPgStatus()) {
      if (loginInput.includes('@')) {
        const result = await query(`SELECT * FROM users WHERE LOWER(email) = $1 AND is_active = TRUE`, [loginInput.toLowerCase()]);
        user = result.rows[0];
      } else {
        const cleanInput = loginInput.replace(/\D/g, '');
        const result = await query(
          `SELECT * FROM users WHERE (phone = $1 OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $2) AND is_active = TRUE`,
          [loginInput, cleanInput]
        );
        user = result.rows[0];
      }
    } else {
      const isEmail = loginInput.includes('@');
      user = inMemoryStore.users.find(u => {
        if (!u.is_active) return false;
        if (isEmail) {
          return u.email?.toLowerCase() === loginInput.toLowerCase();
        } else {
          const cleanInput = loginInput.replace(/\D/g, '');
          const cleanUserPhone = (u.phone || '').replace(/\D/g, '');
          return u.phone === loginInput || (cleanInput && cleanUserPhone && cleanInput === cleanUserPhone);
        }
      });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials or inactive account' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email/phone or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'trader' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          country: user.country,
          referral_code: user.referral_code,
          kyc_status: user.kyc_status
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Login processing failed', error: err.message });
  }
};

export const getProfile = async (req, res) => {
  const userId = req.user.id;
  
  let user = null;
  let wallet = null;

  if (checkPgStatus()) {
    const userRes = await query(`SELECT id, first_name, last_name, email, country, phone, referral_code, kyc_status, is_active FROM users WHERE id = $1`, [userId]);
    user = userRes.rows[0];
    const walletRes = await query(`SELECT wallet_number, balance, currency FROM wallets WHERE user_id = $1`, [userId]);
    wallet = walletRes.rows[0];
  } else {
    user = inMemoryStore.users.find(u => u.id === userId);
    wallet = inMemoryStore.wallets.find(w => w.user_id === userId);
  }

  if (!user) {
    return res.status(404).json({ message: 'User profile not found' });
  }

  return res.json({
    message: 'Profile retrieved successfully',
    data: { user, wallet }
  });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT id, email, first_name FROM users WHERE LOWER(email) = $1 AND is_active = TRUE`, [normalizedEmail]);
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === normalizedEmail && u.is_active);
    }

    if (!user) {
      return res.status(404).json({ message: 'No registered account found with this email address' });
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

    return res.json({
      message: 'Password reset token generated successfully',
      data: {
        email: normalizedEmail,
        resetToken,
        instructions: 'Verification token generated. Enter new password to complete reset.'
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to process password reset request', error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  const { email, new_password } = req.body;

  if (!email || !new_password) {
    return res.status(400).json({ message: 'Email address and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT id FROM users WHERE LOWER(email) = $1 AND is_active = TRUE`, [normalizedEmail]);
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === normalizedEmail && u.is_active);
    }

    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    if (checkPgStatus()) {
      await query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newPasswordHash, user.id]);
    } else {
      user.password_hash = newPasswordHash;
    }

    return res.json({
      message: 'Password successfully updated! You can now sign in with your new password.',
      data: { success: true }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
};
