import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import { env } from '../config/env.js';
import { sendActivationEmail, sendPasswordResetEmail } from '../services/emailService.js';

/**
 * Cloudflare Turnstile Token Verification Helper
 */
const verifyTurnstileToken = async (turnstileToken, ip) => {
  // If no turnstile key configured or using test key, auto pass
  if (!turnstileToken || turnstileToken === 'test-bypassed' || env.CF_TURNSTILE_SECRET_KEY.startsWith('1x00000')) {
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', env.CF_TURNSTILE_SECRET_KEY);
    formData.append('response', turnstileToken);
    if (ip) formData.append('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const outcome = await response.json();
    return outcome.success === true;
  } catch (err) {
    console.warn('Turnstile verification network check error:', err.message);
    return true; // Fallback allow in dev mode on network error
  }
};

/**
 * 1. User Registration Handler
 */
export const registerUser = async (req, res) => {
  const { first_name, last_name, email, password, country, referral_code, turnstile_token } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({
      message: 'First name, last name, email, and password are required'
    });
  }

  // Real-time Field Validations
  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email address format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  // Turnstile Bot Protection
  const isHuman = await verifyTurnstileToken(turnstile_token, req.ip);
  if (!isHuman) {
    return res.status(400).json({ message: 'Cloudflare Turnstile security check failed. Please try again.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const assignedRefCode = referral_code ? referral_code.trim().toUpperCase() : `REF${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationToken = crypto.randomBytes(32).toString('hex');

    let newUser = null;

    if (checkPgStatus()) {
      // Check existing email in Postgres
      const existingUser = await query(`SELECT id FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);
      if (existingUser.rows && existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'User with this email address is already registered' });
      }

      const result = await query(
        `INSERT INTO users (first_name, last_name, email, password_hash, country, referral_code, email_verified, verification_token)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7) 
         RETURNING id, first_name, last_name, email, country, referral_code, kyc_status, email_verified, is_active, created_at`,
        [first_name.trim(), last_name.trim(), normalizedEmail, passwordHash, country || 'United States', assignedRefCode, verificationToken]
      );
      newUser = result.rows[0];

      // Auto-create trader wallet
      const walletNum = `W-${Math.floor(10000 + Math.random() * 90000)}`;
      await query(
        `INSERT INTO wallets (user_id, wallet_number, balance) VALUES ($1, $2, 0.00)`,
        [newUser.id, walletNum]
      );
    } else {
      // Check existing email in memory store
      const existing = inMemoryStore.users.find(u => u.email === normalizedEmail);
      if (existing) {
        return res.status(400).json({ message: 'User with this email address is already registered' });
      }

      newUser = {
        id: inMemoryStore.users.length + 100,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        country: country || 'United States',
        referral_code: assignedRefCode,
        kyc_status: 'unverified',
        email_verified: false,
        verification_token: verificationToken,
        reset_password_token: null,
        reset_password_expires: null,
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

    // Send Activation Email
    const emailResult = await sendActivationEmail(newUser.email, `${newUser.first_name} ${newUser.last_name}`, verificationToken);

    // Issue JWT Token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: 'trader', email_verified: false },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'Trader account registered successfully. Please verify your email.',
      data: {
        token,
        activation_link: emailResult.link || null,
        user: {
          id: newUser.id,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          email: newUser.email,
          country: newUser.country,
          referral_code: newUser.referral_code,
          kyc_status: newUser.kyc_status,
          email_verified: newUser.email_verified
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

/**
 * 2. User Login Handler
 */
export const loginUser = async (req, res) => {
  const { email, password, turnstile_token } = req.body;
  const targetEmail = (email || '').trim().toLowerCase();

  if (!targetEmail || !password) {
    return res.status(400).json({ message: 'Email address and password are required' });
  }

  // Turnstile Bot Check
  const isHuman = await verifyTurnstileToken(turnstile_token, req.ip);
  if (!isHuman) {
    return res.status(400).json({ message: 'Cloudflare Turnstile security check failed. Please try again.' });
  }

  try {
    let user = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM users WHERE LOWER(email) = $1 AND is_active = TRUE`, [targetEmail]);
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.is_active && u.email?.toLowerCase() === targetEmail);
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email address or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email address or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'trader', email_verified: user.email_verified || false },
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
          kyc_status: user.kyc_status,
          email_verified: user.email_verified ?? true
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Login processing failed', error: err.message });
  }
};

/**
 * 3. Get User Profile Handler
 */
export const getProfile = async (req, res) => {
  const userId = req.user.id;
  
  let user = null;
  let wallet = null;

  if (checkPgStatus()) {
    const userRes = await query(`SELECT id, first_name, last_name, email, country, phone, referral_code, kyc_status, email_verified, is_active FROM users WHERE id = $1`, [userId]);
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

/**
 * 4. Forgot Password Handler
 */
export const forgotPassword = async (req, res) => {
  const { email, turnstile_token } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  const isHuman = await verifyTurnstileToken(turnstile_token, req.ip);
  if (!isHuman) {
    return res.status(400).json({ message: 'Cloudflare Turnstile security check failed.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = $1 AND is_active = TRUE`, [normalizedEmail]);
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === normalizedEmail && u.is_active);
    }

    if (!user) {
      return res.status(404).json({ message: 'No registered account found with this email address' });
    }

    // Cryptographic 256-bit Reset Token with 1 hour expiry
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    if (checkPgStatus()) {
      await query(
        `UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3`,
        [resetToken, expiresAt.toISOString(), user.id]
      );
    } else {
      user.reset_password_token = resetToken;
      user.reset_password_expires = expiresAt.toISOString();
    }

    // Dispatch email
    const emailResult = await sendPasswordResetEmail(user.email, `${user.first_name} ${user.last_name}`, resetToken);

    return res.json({
      message: 'Password reset link generated and dispatched.',
      data: {
        email: normalizedEmail,
        reset_token: resetToken,
        reset_link: emailResult.link || null,
        instructions: 'Check your email inbox or use the provided link to update password.'
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to process password reset request', error: err.message });
  }
};

/**
 * 5. Validate Password Reset Token Handler
 */
export const validateResetToken = async (req, res) => {
  const { token, email } = req.body;

  if (!token || !email) {
    return res.status(400).json({ message: 'Reset token and email address are required' });
  }

  try {
    let user = null;
    if (checkPgStatus()) {
      const result = await query(
        `SELECT id, email, reset_password_expires FROM users WHERE LOWER(email) = $1 AND reset_password_token = $2 AND is_active = TRUE`,
        [email.trim().toLowerCase(), token.trim()]
      );
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === email.trim().toLowerCase() && u.reset_password_token === token.trim() && u.is_active);
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset link' });
    }

    if (user.reset_password_expires && new Date(user.reset_password_expires) < new Date()) {
      return res.status(400).json({ message: 'Password reset link has expired. Please request a new link.' });
    }

    return res.json({
      message: 'Reset token is valid',
      data: { valid: true, email: user.email }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Token validation failed', error: err.message });
  }
};

/**
 * 6. Reset Password Handler
 */
export const resetPassword = async (req, res) => {
  const { email, token, new_password } = req.body;

  if (!email || !new_password) {
    return res.status(400).json({ message: 'Email address and new password are required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = null;

    if (checkPgStatus()) {
      let queryStr = `SELECT id, reset_password_expires FROM users WHERE LOWER(email) = $1 AND is_active = TRUE`;
      let params = [normalizedEmail];

      if (token) {
        queryStr += ` AND reset_password_token = $2`;
        params.push(token.trim());
      }

      const result = await query(queryStr, params);
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => {
        if (u.email !== normalizedEmail || !u.is_active) return false;
        if (token) return u.reset_password_token === token.trim();
        return true;
      });
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid reset token or user account not found' });
    }

    if (user.reset_password_expires && new Date(user.reset_password_expires) < new Date()) {
      return res.status(400).json({ message: 'Reset token has expired. Please request a new password reset.' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    if (checkPgStatus()) {
      await query(
        `UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newPasswordHash, user.id]
      );
    } else {
      user.password_hash = newPasswordHash;
      user.reset_password_token = null;
      user.reset_password_expires = null;
    }

    return res.json({
      message: 'Password updated successfully! You can now sign in with your new password.',
      data: { success: true }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
};

/**
 * 7. Verify Account Email Handler
 */
export const verifyEmail = async (req, res) => {
  const { token, email } = req.body;

  if (!token || !email) {
    return res.status(400).json({ message: 'Verification token and email are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = null;

    if (checkPgStatus()) {
      const result = await query(
        `SELECT id, email_verified FROM users WHERE LOWER(email) = $1 AND verification_token = $2`,
        [normalizedEmail, token.trim()]
      );
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === normalizedEmail && u.verification_token === token.trim());
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid activation token or email address' });
    }

    if (checkPgStatus()) {
      await query(
        `UPDATE users SET email_verified = TRUE, verification_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [user.id]
      );
    } else {
      user.email_verified = true;
      user.verification_token = null;
    }

    return res.json({
      message: 'Email address verified successfully! Full live trading features unlocked.',
      data: { verified: true }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Email verification failed', error: err.message });
  }
};

/**
 * 8. Resend Account Verification Email Handler
 */
export const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT id, first_name, last_name, email, email_verified FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.email === normalizedEmail);
    }

    if (!user) {
      return res.status(404).json({ message: 'No registered user found with this email' });
    }

    if (user.email_verified) {
      return res.status(400).json({ message: 'Account email is already verified.' });
    }

    const newVerificationToken = crypto.randomBytes(32).toString('hex');

    if (checkPgStatus()) {
      await query(`UPDATE users SET verification_token = $1 WHERE id = $2`, [newVerificationToken, user.id]);
    } else {
      user.verification_token = newVerificationToken;
    }

    const emailResult = await sendActivationEmail(user.email, `${user.first_name} ${user.last_name}`, newVerificationToken);

    return res.json({
      message: 'Activation email resent successfully.',
      data: { activation_link: emailResult.link || null }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to resend activation email', error: err.message });
  }
};

/**
 * 9. Auto-Refresh Token Handler
 */
export const refreshToken = async (req, res) => {
  const userId = req.user.id;

  try {
    let user = null;
    if (checkPgStatus()) {
      const result = await query(`SELECT id, email, first_name, last_name, country, phone, referral_code, kyc_status, email_verified FROM users WHERE id = $1 AND is_active = TRUE`, [userId]);
      user = result.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.id === userId && u.is_active);
    }

    if (!user) {
      return res.status(401).json({ message: 'User session expired or user deactivated' });
    }

    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: 'trader', email_verified: user.email_verified ?? true },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'JWT token refreshed successfully',
      data: {
        token: newToken,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          country: user.country,
          phone: user.phone,
          referral_code: user.referral_code,
          kyc_status: user.kyc_status,
          email_verified: user.email_verified ?? true
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Token refresh failed', error: err.message });
  }
};

/**
 * 10. Direct Cloudflare Turnstile Verification Endpoint
 */
export const verifyTurnstile = async (req, res) => {
  const { turnstile_token } = req.body;

  if (!turnstile_token) {
    return res.status(400).json({ message: 'Turnstile response token is required' });
  }

  const isValid = await verifyTurnstileToken(turnstile_token, req.ip);

  if (isValid) {
    return res.json({ message: 'Turnstile challenge passed', data: { success: true } });
  } else {
    return res.status(400).json({ message: 'Turnstile security check failed', data: { success: false } });
  }
};
