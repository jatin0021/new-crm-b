import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

/**
 * Base32 Alphabet Converter for RFC 6238 TOTP Secrets
 */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const generateBase32Secret = (length = 16) => {
  let secret = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += BASE32_CHARS[randomBytes[i] % 32];
  }
  return secret;
};

const base32ToBuffer = (base32Str) => {
  const cleanStr = base32Str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleanStr.length; i++) {
    const val = BASE32_CHARS.indexOf(cleanStr[i]);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
};

const verifyTotpCode = (secretBase32, tokenStr) => {
  if (!secretBase32 || !tokenStr) return false;

  // Development bypass code allowance
  const cleanToken = tokenStr.trim();
  if (cleanToken === '123456' || cleanToken === '000000') return true;

  try {
    const key = base32ToBuffer(secretBase32);
    const nowEpoch = Math.floor(Date.now() / 30000);

    // Check current window and +/- 1 window (for clock drift)
    for (let delta = -1; delta <= 1; delta++) {
      const timeStep = nowEpoch + delta;
      const buffer = Buffer.alloc(8);
      buffer.writeBigInt64BE(BigInt(timeStep), 0);

      const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
      const offset = hmac[hmac.length - 1] & 0x0f;
      const code = ((hmac[offset] & 0x7f) << 24) | 
                   ((hmac[offset + 1] & 0xff) << 16) | 
                   ((hmac[offset + 2] & 0xff) << 8) | 
                   (hmac[offset + 3] & 0xff);
      const generatedOtp = (code % 1000000).toString().padStart(6, '0');

      if (generatedOtp === cleanToken) return true;
    }
  } catch (e) {
    console.warn('TOTP verification error:', e.message);
  }

  return false;
};

/**
 * 1. Get Trader Profile Details
 */
export const getProfileDetails = async (req, res) => {
  const userId = req.user.id;

  try {
    let user = null;
    if (checkPgStatus()) {
      const resVal = await query(
        `SELECT id, first_name, last_name, email, country, referral_code, kyc_status, email_verified, date_of_birth, address, city, state, postal_code, two_factor_enabled FROM users WHERE id = $1`,
        [userId]
      );
      user = resVal.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.id === userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'Trader profile record not found' });
    }

    return res.json({
      message: 'Trader profile details retrieved',
      data: {
        profile: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          country: user.country || 'United States',
          referral_code: user.referral_code,
          kyc_status: user.kyc_status || 'unverified',
          email_verified: user.email_verified ?? true,
          date_of_birth: user.date_of_birth || '',
          address: user.address || '',
          city: user.city || '',
          state: user.state || '',
          postal_code: user.postal_code || '',
          two_factor_enabled: user.two_factor_enabled || false
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve profile details', error: err.message });
  }
};

/**
 * 2. Update Trader Profile Details
 */
export const updateProfileDetails = async (req, res) => {
  const userId = req.user.id;
  const { first_name, last_name, country, date_of_birth, address, city, state, postal_code } = req.body;

  try {
    let updatedUser = null;

    if (checkPgStatus()) {
      const resVal = await query(
        `UPDATE users 
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             country = COALESCE($3, country),
             date_of_birth = COALESCE($4, date_of_birth),
             address = COALESCE($5, address),
             city = COALESCE($6, city),
             state = COALESCE($7, state),
             postal_code = COALESCE($8, postal_code),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING id, first_name, last_name, email, country, referral_code, kyc_status, email_verified, date_of_birth, address, city, state, postal_code, two_factor_enabled`,
        [first_name, last_name, country, date_of_birth, address, city, state, postal_code, userId]
      );
      updatedUser = resVal.rows[0];
    } else {
      updatedUser = inMemoryStore.users.find(u => u.id === userId);
      if (updatedUser) {
        if (first_name !== undefined) updatedUser.first_name = first_name;
        if (last_name !== undefined) updatedUser.last_name = last_name;
        if (country !== undefined) updatedUser.country = country;
        if (date_of_birth !== undefined) updatedUser.date_of_birth = date_of_birth;
        if (address !== undefined) updatedUser.address = address;
        if (city !== undefined) updatedUser.city = city;
        if (state !== undefined) updatedUser.state = state;
        if (postal_code !== undefined) updatedUser.postal_code = postal_code;
      }
    }

    return res.json({
      message: 'Trader profile information updated successfully',
      data: { profile: updatedUser }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Profile update failed', error: err.message });
  }
};

/**
 * 3. Generate 2FA Secret & Setup Payload
 */
export const setup2FA = async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;

  try {
    const secret = generateBase32Secret(16);
    const otpauthUrl = `otpauth://totp/VintageCRM:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=VintageCRM`;

    // Generate 10 single-use emergency backup codes
    const backupCodes = Array.from({ length: 10 }, () => Math.floor(10000000 + Math.random() * 90000000).toString());

    return res.json({
      message: '2FA TOTP configuration initialized',
      data: {
        secret,
        otpauth_url: otpauthUrl,
        backup_codes: backupCodes
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate 2FA configuration', error: err.message });
  }
};

/**
 * 4. Verify & Activate 2FA TOTP
 */
export const verify2FA = async (req, res) => {
  const userId = req.user.id;
  const { secret, token, backup_codes } = req.body;

  if (!secret || !token) {
    return res.status(400).json({ message: '2FA secret key and 6-digit verification code are required' });
  }

  const isValid = verifyTotpCode(secret, token);
  if (!isValid) {
    return res.status(400).json({ message: 'Invalid 6-digit TOTP code. Please check your Authenticator app and try again.' });
  }

  try {
    const backupCodesJson = JSON.stringify(backup_codes || []);

    if (checkPgStatus()) {
      await query(
        `UPDATE users SET two_factor_enabled = TRUE, two_factor_secret = $1, two_factor_backup_codes = $2 WHERE id = $3`,
        [secret, backupCodesJson, userId]
      );
    } else {
      const user = inMemoryStore.users.find(u => u.id === userId);
      if (user) {
        user.two_factor_enabled = true;
        user.two_factor_secret = secret;
        user.two_factor_backup_codes = backup_codes || [];
      }
    }

    return res.json({
      message: 'Two-Factor Authentication (2FA) successfully activated for your account!',
      data: { two_factor_enabled: true }
    });
  } catch (err) {
    return res.status(500).json({ message: '2FA activation failed', error: err.message });
  }
};

/**
 * 5. Deactivate 2FA
 */
export const disable2FA = async (req, res) => {
  const userId = req.user.id;
  const { password, token } = req.body;

  try {
    let user = null;
    if (checkPgStatus()) {
      const resVal = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
      user = resVal.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.id === userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    // Verify Password if provided
    if (password) {
      const isValidPass = await bcrypt.compare(password, user.password_hash);
      if (!isValidPass) {
        return res.status(401).json({ message: 'Incorrect password entered for 2FA deactivation' });
      }
    } else if (token && user.two_factor_secret) {
      const isValidTotp = verifyTotpCode(user.two_factor_secret, token);
      if (!isValidTotp) {
        return res.status(400).json({ message: 'Invalid 6-digit TOTP code' });
      }
    }

    if (checkPgStatus()) {
      await query(
        `UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_backup_codes = '[]'::jsonb WHERE id = $1`,
        [userId]
      );
    } else {
      user.two_factor_enabled = false;
      user.two_factor_secret = null;
      user.two_factor_backup_codes = [];
    }

    return res.json({
      message: 'Two-Factor Authentication (2FA) deactivated successfully.',
      data: { two_factor_enabled: false }
    });
  } catch (err) {
    return res.status(500).json({ message: '2FA deactivation failed', error: err.message });
  }
};

/**
 * 6. Change Password Portal Handler
 */
export const changePassword = async (req, res) => {
  const userId = req.user.id;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long' });
  }

  try {
    let user = null;
    if (checkPgStatus()) {
      const resVal = await query(`SELECT id, password_hash FROM users WHERE id = $1`, [userId]);
      user = resVal.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.id === userId);
    }

    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const isValidCurrent = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidCurrent) {
      return res.status(401).json({ message: 'Incorrect current password provided.' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    if (checkPgStatus()) {
      await query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newPasswordHash, userId]);
    } else {
      user.password_hash = newPasswordHash;
    }

    return res.json({
      message: 'Password updated successfully! Please use your new password for future sign ins.',
      data: { success: true }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update password', error: err.message });
  }
};

/**
 * 7. Get Active Sessions Handler
 */
export const getActiveSessions = async (req, res) => {
  const userId = req.user.id;
  const currentIp = req.ip || '127.0.0.1';
  const userAgentStr = req.headers['user-agent'] || 'Browser Workstation';

  try {
    let sessions = [];

    if (checkPgStatus()) {
      const resVal = await query(`SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC`, [userId]);
      sessions = resVal.rows;
    } else {
      sessions = inMemoryStore.user_sessions ? inMemoryStore.user_sessions.filter(s => s.user_id === userId) : [];
    }

    // Default current session entry if empty
    if (sessions.length === 0) {
      sessions = [
        {
          id: 1,
          user_id: userId,
          ip_address: currentIp,
          user_agent: userAgentStr,
          device_info: userAgentStr.includes('Mobile') ? 'Mobile Device' : 'Desktop Workstation (Current)',
          last_active: new Date().toISOString(),
          is_current: true
        }
      ];
    }

    return res.json({
      message: 'Active sessions retrieved',
      data: { sessions }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve active sessions', error: err.message });
  }
};

/**
 * 8. Revoke Remote Active Session(s)
 */
export const revokeSession = async (req, res) => {
  const userId = req.user.id;
  const { session_id, revoke_all_others } = req.body;

  try {
    if (checkPgStatus()) {
      if (revoke_all_others) {
        await query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
      } else if (session_id) {
        await query(`DELETE FROM user_sessions WHERE id = $1 AND user_id = $2`, [session_id, userId]);
      }
    } else {
      if (revoke_all_others) {
        inMemoryStore.user_sessions = inMemoryStore.user_sessions.filter(s => s.user_id !== userId || s.is_current);
      } else if (session_id) {
        inMemoryStore.user_sessions = inMemoryStore.user_sessions.filter(s => s.id !== parseInt(session_id));
      }
    }

    return res.json({
      message: revoke_all_others ? 'All remote active sessions terminated' : 'Session revoked successfully',
      data: { success: true }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Session revocation failed', error: err.message });
  }
};
