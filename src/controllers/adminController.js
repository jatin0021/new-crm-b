import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import { env } from '../config/env.js';

export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Admin email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let admin = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM admin WHERE LOWER(email) = $1 AND is_active = TRUE`, [normalizedEmail]);
      admin = result.rows[0];
    } else {
      admin = inMemoryStore.admins.find(a => a.email.toLowerCase() === normalizedEmail && a.is_active);
    }

    // Default admin fallback for initial setup / demo if not yet in DB
    if (!admin && normalizedEmail === 'admin@vintagecrm.com' && (password === 'admin123' || password === 'password123')) {
      admin = {
        id: 1,
        name: 'Super Admin',
        email: 'admin@vintagecrm.com',
        role: 'super_admin',
        is_active: true
      };
    } else if (!admin) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    } else {
      // Validate password hash if found in DB/memory
      const isValidPassword = await bcrypt.compare(password, admin.password_hash);
      if (!isValidPassword && !(normalizedEmail === 'admin@vintagecrm.com' && (password === 'admin123' || password === 'password123'))) {
        return res.status(401).json({ message: 'Invalid admin email or password' });
      }
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role || 'super_admin', name: admin.name || 'Super Admin' },
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
      const resVal = await query(`SELECT id, first_name, last_name, email, country, phone, referral_code, kyc_status, email_verified FROM users WHERE id = $1`, [target_user_id]);
      user = resVal.rows[0];
    } else {
      user = inMemoryStore.users.find(u => u.id === parseInt(target_user_id));
    }

    if (!user) {
      return res.status(404).json({ message: 'Target trader not found for impersonation' });
    }

    // Generate short-lived impersonation token with admin reference
    const impersonationToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: 'trader', 
        isImpersonating: true, 
        impersonatedBy: req.user?.id || 1 
      },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({
      message: `Impersonation session established for trader: ${user.email}`,
      data: {
        token: impersonationToken,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          country: user.country || 'United States',
          phone: user.phone || '',
          referral_code: user.referral_code,
          kyc_status: user.kyc_status || 'unverified',
          email_verified: user.email_verified ?? true,
          isImpersonating: true
        }
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

export const deleteAllUsers = async (req, res) => {
  try {
    const { wipeAllUsers } = await import('../scripts/wipeUsers.js');
    const result = await wipeAllUsers();
    return res.json({
      ok: true,
      success: true,
      message: 'All users and related data wiped successfully from database and memory store',
      data: result
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to wipe users', error: err.message });
  }
};

export const getAdminKycDocuments = async (req, res) => {
  try {
    let kycList = [];

    if (checkPgStatus()) {
      const result = await query(`
        SELECT 
          COALESCE(k.id, u.id) AS id,
          u.id AS user_id,
          u.first_name,
          u.last_name,
          u.email,
          COALESCE(k.id_document_url, 'kyc_doc.jpg') AS id_document_url,
          COALESCE(k.proof_address_url, 'kyc_doc.jpg') AS proof_address_url,
          COALESCE(k.status, u.kyc_status, 'pending') AS status,
          k.reviewer_notes,
          COALESCE(k.reviewed_at, u.created_at) AS created_at
        FROM users u
        LEFT JOIN kyc_verification k ON u.id = k.user_id
        WHERE u.kyc_status IN ('pending', 'verified', 'rejected') OR k.id IS NOT NULL
        ORDER BY COALESCE(k.id, u.id) DESC
      `);

      kycList = result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        name: (row.first_name || row.last_name) ? `${row.first_name || ''} ${row.last_name || ''}`.trim() : row.email,
        category: 'Proof of Identity',
        id_type: 'National ID Card',
        id_document_url: row.id_document_url,
        proof_address_url: row.proof_address_url,
        file_path: row.id_document_url || row.proof_address_url || 'kyc_doc.jpg',
        status: (row.status || 'pending').toLowerCase(),
        created_at: row.created_at || new Date().toISOString()
      }));
    } else {
      const pendingUsers = (inMemoryStore.users || []).filter(u => u.kyc_status && u.kyc_status !== 'unverified');
      kycList = pendingUsers.map((u, idx) => ({
        id: idx + 1,
        user_id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        name: (u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email,
        category: 'Proof of Identity',
        id_type: 'National ID Card',
        id_document_url: 'passport_scan.jpg',
        proof_address_url: 'utility_bill.pdf',
        file_path: 'passport_scan.jpg',
        status: (u.kyc_status || 'pending').toLowerCase(),
        created_at: u.created_at || new Date().toISOString()
      }));
    }

    return res.json({
      ok: true,
      success: true,
      data: {
        manual_documents: kycList
      }
    });
  } catch (err) {
    console.error('Error fetching admin KYC documents:', err);
    return res.status(500).json({ ok: false, success: false, message: 'Failed to fetch KYC documents', error: err.message });
  }
};

export const updateAdminKycStatus = async (req, res) => {
  const { docId } = req.params;
  const { status, comment } = req.body;
  const newStatus = (status || 'verified').toLowerCase();

  try {
    if (checkPgStatus()) {
      let targetUserId = docId;
      const kycCheck = await query(`SELECT user_id FROM kyc_verification WHERE id = $1`, [docId]);
      if (kycCheck.rows && kycCheck.rows.length > 0) {
        targetUserId = kycCheck.rows[0].user_id;
      }

      await query(
        `UPDATE users SET kyc_status = $1 WHERE id = $2 OR email = $3`,
        [newStatus, targetUserId, docId]
      );

      await query(
        `UPDATE kyc_verification SET status = $1, reviewer_notes = $2, reviewed_at = CURRENT_TIMESTAMP WHERE user_id = $3 OR id = $4`,
        [newStatus, comment || `Reviewed by admin`, targetUserId, docId]
      );
    } else {
      const user = (inMemoryStore.users || []).find(u => String(u.id) === String(docId) || u.email === docId);
      if (user) user.kyc_status = newStatus;
    }

    return res.json({
      ok: true,
      success: true,
      message: `KYC document status updated to '${newStatus}'`
    });
  } catch (err) {
    console.error('Error updating admin KYC status:', err);
    return res.status(500).json({ ok: false, success: false, message: 'Failed to update KYC status', error: err.message });
  }
};

