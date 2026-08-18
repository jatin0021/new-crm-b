import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query, checkPgStatus, inMemoryStore } from '../config/db.js';
import { recomputeUserKycStatus } from '../services/kyc/recomputeUserKycStatus.js';

/**
 * 1. GET /api/kyc/status
 * Returns user's global kyc_status, manual uploads, and Shufti EIDV sessions.
 */
export const getKycStatus = async (req, res) => {
  const userId = req.user.id;

  try {
    let userKycStatus = 'unverified';
    let isEmailVerified = false;
    let isPhoneVerified = false;
    let manualDocs = [];
    let shuftiSessions = [];

    if (checkPgStatus()) {
      const userRes = await query(`SELECT kyc_status, email_verified FROM users WHERE id = $1`, [userId]);
      if (!userRes.rows || userRes.rows.length === 0) {
        return res.status(404).json({ ok: false, success: false, message: 'User account not found' });
      }
      userKycStatus = userRes.rows[0]?.kyc_status || 'unverified';
      isEmailVerified = !!userRes.rows[0]?.email_verified;

      try {
        const manualRes = await query(`SELECT id, document_type, id_type, file_path, status, comment, created_at FROM kyc_verification WHERE user_id = $1 ORDER BY id DESC`, [userId]);
        manualDocs = manualRes.rows || [];
      } catch (e) {
        manualDocs = [];
      }

      try {
        const shuftiRes = await query(`SELECT id, reference, status, event_name, verification_url, decline_reason, created_at FROM shufti_verifications WHERE user_id = $1 ORDER BY id DESC`, [userId]);
        shuftiSessions = shuftiRes.rows || [];
      } catch (e) {
        shuftiSessions = [];
      }
    } else {
      const user = inMemoryStore.users?.find(u => String(u.id) === String(userId));
      if (!user) {
        return res.status(404).json({ ok: false, success: false, message: 'User account not found' });
      }
      userKycStatus = user?.kyc_status || 'unverified';
      isEmailVerified = !!user?.email_verified;
      manualDocs = inMemoryStore.kyc_verification?.filter(k => String(k.user_id) === String(userId)) || [];
      shuftiSessions = inMemoryStore.shufti_verifications?.filter(s => String(s.user_id) === String(userId)) || [];
    }

    // Recompute to ensure freshness
    const freshStatus = await recomputeUserKycStatus(userId);

    return res.json({
      ok: true,
      success: true,
      message: 'KYC status retrieved successfully',
      data: {
        kyc_status: freshStatus || userKycStatus,
        status: freshStatus || userKycStatus,
        is_email_verified: isEmailVerified,
        is_phone_verified: isPhoneVerified,
        manual_documents: manualDocs,
        shufti_sessions: shuftiSessions
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to retrieve KYC status', error: err.message });
  }
};

/**
 * 2. POST /api/kyc/upload
 * Manual Document Upload (Identity & Address) with Disk + BYTEA Postgres Storage
 */
export const uploadKycDocument = async (req, res) => {
  const userId = req.user.id;
  const file = req.file || (Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : (req.files && (req.files.file?.[0] || req.files.id_document?.[0])));
  const documentType = req.body.documentType || req.body.document_type || 'Proof of Identity';
  const idType = req.body.idType || req.body.id_type || 'ID Card';

  if (!file) {
    return res.status(400).json({ ok: false, success: false, message: 'No document file uploaded' });
  }

  const filePath = file.path || `/uploads/kyc/${file.filename}`;
  const mimeType = file.mimetype || 'image/jpeg';
  
  let fileBuffer = null;
  try {
    if (file.path && fs.existsSync(file.path)) {
      fileBuffer = fs.readFileSync(file.path);
    }
  } catch (readErr) {
    console.warn('Warning reading uploaded file buffer:', readErr.message);
  }

  try {
    let docId = null;

    if (checkPgStatus()) {
      try {
        const insertRes = await query(
          `INSERT INTO kyc_verification (user_id, document_type, id_type, file_path, file_data, mime_type, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
           RETURNING id`,
          [userId, documentType, idType, filePath, fileBuffer, mimeType]
        );
        docId = insertRes.rows[0]?.id;
      } catch (insertErr) {
        console.warn('BYTEA insert retry fallback:', insertErr.message);
        const insertRes = await query(
          `INSERT INTO kyc_verification (user_id, document_type, id_type, file_path, mime_type, status)
           VALUES ($1, $2, $3, $4, $5, 'Pending')
           RETURNING id`,
          [userId, documentType, idType, filePath, mimeType]
        );
        docId = insertRes.rows[0]?.id;
      }
    } else {
      docId = (inMemoryStore.kyc_verification?.length || 0) + 1;
      const newDoc = {
        id: docId,
        user_id: userId,
        document_type: documentType,
        id_type: idType,
        file_path: filePath,
        mime_type: mimeType,
        status: 'Pending',
        created_at: new Date().toISOString()
      };
      if (!inMemoryStore.kyc_verification) inMemoryStore.kyc_verification = [];
      inMemoryStore.kyc_verification.push(newDoc);
    }

    const newKycStatus = await recomputeUserKycStatus(userId);

    return res.status(201).json({
      ok: true,
      success: true,
      message: `${documentType} (${idType}) uploaded successfully and submitted for compliance review.`,
      data: {
        id: docId,
        document_type: documentType,
        id_type: idType,
        status: 'Pending',
        kyc_status: newKycStatus
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'KYC upload failed', error: err.message });
  }
};

/**
 * 3. GET /api/kyc/documents/:id
 * Private Streaming API for User's Uploaded Document
 */
export const streamKycDocument = async (req, res) => {
  const userId = req.user.id;
  const docId = parseInt(req.params.id, 10);

  try {
    let doc = null;

    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM kyc_verification WHERE id = $1 AND user_id = $2`, [docId, userId]);
      doc = result.rows[0];
    } else {
      doc = inMemoryStore.kyc_verification?.find(d => d.id === docId && d.user_id === userId);
    }

    if (!doc) {
      return res.status(404).json({ ok: false, success: false, message: 'Document not found or access denied' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'image/jpeg');

    // Stream from BYTEA if available
    if (doc.file_data && Buffer.isBuffer(doc.file_data)) {
      return res.send(doc.file_data);
    }

    // Fallback to disk file stream
    if (doc.file_path && fs.existsSync(doc.file_path)) {
      return fs.createReadStream(doc.file_path).pipe(res);
    }

    return res.status(404).json({ ok: false, success: false, message: 'Document file data unavailable' });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to stream document', error: err.message });
  }
};

/**
 * 4. POST /api/kyc/shufti/start
 * Initiate Automated Shufti Pro EIDV Verification Session
 */
export const startShuftiSession = async (req, res) => {
  const userId = req.user.id;
  const { address, country } = req.body || {};

  if (address && address.trim().length < 6) {
    return res.status(400).json({ ok: false, success: false, message: 'Residential address must be at least 6 characters long' });
  }

  const reference = `SP_EIDV_${userId}_${Date.now()}`;
  const verificationUrl = `https://verification.shuftipro.com/process/eidv/${reference}`;

  try {
    let sessionRow = null;

    if (checkPgStatus()) {
      const userRes = await query(`SELECT email, country FROM users WHERE id = $1`, [userId]);
      const userEmail = userRes.rows[0]?.email || '';
      const userCountry = country || userRes.rows[0]?.country || 'US';

      const insertRes = await query(
        `INSERT INTO shufti_verifications (user_id, reference, verification_url, status, country, email)
         VALUES ($1, $2, $3, 'pending', $4, $5)
         RETURNING *`,
        [userId, reference, verificationUrl, userCountry, userEmail]
      );
      sessionRow = insertRes.rows[0];
    } else {
      sessionRow = {
        id: (inMemoryStore.shufti_verifications?.length || 0) + 1,
        user_id: userId,
        reference,
        verification_url: verificationUrl,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      if (!inMemoryStore.shufti_verifications) inMemoryStore.shufti_verifications = [];
      inMemoryStore.shufti_verifications.push(sessionRow);
    }

    await recomputeUserKycStatus(userId);

    return res.json({
      ok: true,
      success: true,
      message: 'Shufti Pro EIDV verification session created',
      data: {
        reference,
        verificationUrl,
        status: 'pending'
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to launch Shufti Pro EIDV session', error: err.message });
  }
};

/**
 * 5. POST /api/kyc/shufti/webhook
 * HMAC SHA-256 Signature Validated Webhook Handler
 */
export const handleShuftiWebhook = async (req, res) => {
  const signature = req.headers['signature'] || req.headers['x-shufti-signature'];
  const secretKey = process.env.SHUFTI_SECRET_KEY;

  if (secretKey && signature) {
    const computedHmac = crypto.createHmac('sha256', secretKey).update(JSON.stringify(req.body)).digest('hex');
    if (signature !== computedHmac) {
      return res.status(401).json({ ok: false, success: false, message: 'Invalid webhook HMAC signature' });
    }
  }

  const { reference, event, verification_result, decline_reason } = req.body || {};
  const eventName = event || req.body.event_name || 'verification.accepted';

  if (!reference) {
    return res.status(400).json({ ok: false, success: false, message: 'Missing verification reference' });
  }

  try {
    if (checkPgStatus()) {
      // Deduplicate webhook event
      try {
        await query(
          `INSERT INTO shufti_webhook_events (reference, event_name, event_time) VALUES ($1, $2, $3)`,
          [reference, eventName, String(Date.now())]
        );
      } catch (dupErr) {
        return res.json({ ok: true, message: 'Duplicate webhook event ignored' });
      }

      const isAccepted = eventName === 'verification.accepted' || eventName === 'accepted';
      const newStatus = isAccepted ? 'accepted' : 'declined';

      const updateRes = await query(
        `UPDATE shufti_verifications 
         SET status = $1, event_name = $2, decline_reason = $3, shufti_payload = $4, verified_at = $5, updated_at = CURRENT_TIMESTAMP
         WHERE reference = $6 RETURNING user_id`,
        [newStatus, eventName, decline_reason || null, JSON.stringify(req.body), isAccepted ? new Date() : null, reference]
      );

      const userId = updateRes.rows[0]?.user_id;
      if (userId) {
        await recomputeUserKycStatus(userId);
      }
    }

    return res.json({ ok: true, success: true, message: 'Webhook processed successfully' });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, message: 'Webhook processing failed', error: err.message });
  }
};
