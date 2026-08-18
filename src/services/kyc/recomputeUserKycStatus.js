import { query, checkPgStatus, inMemoryStore } from '../../config/db.js';

/**
 * Recomputes overall user kyc_status based on all manual upload documents and Shufti Pro EIDV sessions.
 * 
 * Rules:
 * - 'verified': Shufti status === 'accepted' OR (Identity doc is 'Approved' AND Address doc is 'Approved')
 * - 'pending': manual docs are 'Pending' OR Shufti is 'pending' / 'review.pending'
 * - 'rejected': doc(s) rejected and no active pending or accepted verifications
 * - 'unverified': default fallback when no documents submitted
 */
export const recomputeUserKycStatus = async (userId) => {
  if (!userId) return 'unverified';

  try {
    let manualDocs = [];
    let shuftiSessions = [];

    if (checkPgStatus()) {
      const manualRes = await query(`SELECT * FROM kyc_verification WHERE user_id = $1`, [userId]);
      manualDocs = manualRes.rows || [];

      try {
        const shuftiRes = await query(`SELECT * FROM shufti_verifications WHERE user_id = $1`, [userId]);
        shuftiSessions = shuftiRes.rows || [];
      } catch (shuftiErr) {
        shuftiSessions = [];
      }
    } else {
      manualDocs = inMemoryStore.kyc_verification ? inMemoryStore.kyc_verification.filter(k => String(k.user_id) === String(userId)) : [];
      shuftiSessions = inMemoryStore.shufti_verifications ? inMemoryStore.shufti_verifications.filter(s => String(s.user_id) === String(userId)) : [];
    }

    // Check Shufti Pro status
    const hasShuftiAccepted = shuftiSessions.some(s => 
      ['accepted', 'approved', 'verified'].includes((s.status || '').toLowerCase()) || 
      s.event_name === 'verification.accepted'
    );
    const hasShuftiPending = shuftiSessions.some(s => ['pending', 'review.pending'].includes((s.status || '').toLowerCase()));

    // Check Manual Documents
    const identityDocs = manualDocs.filter(d => 
      ['proof of identity', 'identity', 'passport', 'id card', 'driver license'].includes((d.document_type || '').toLowerCase()) ||
      ['passport', 'id card', 'driver license', 'national id card'].includes((d.id_type || '').toLowerCase())
    );
    const addressDocs = manualDocs.filter(d => 
      ['proof of address', 'address', 'utility bill', 'bank statement'].includes((d.document_type || '').toLowerCase())
    );

    const hasApprovedIdentity = identityDocs.some(d => ['approved', 'verified'].includes((d.status || '').toLowerCase()));
    const hasApprovedAddress = addressDocs.some(d => ['approved', 'verified'].includes((d.status || '').toLowerCase()));
    const hasAnyApprovedManualDoc = manualDocs.some(d => ['approved', 'verified'].includes((d.status || '').toLowerCase()));

    const hasPendingDocs = manualDocs.some(d => (d.status || '').toLowerCase() === 'pending');
    const hasRejectedDocs = manualDocs.some(d => (d.status || '').toLowerCase() === 'rejected');

    let calculatedStatus = 'unverified';

    if (hasShuftiAccepted || (hasApprovedIdentity && hasApprovedAddress) || hasAnyApprovedManualDoc) {
      calculatedStatus = 'verified';
    } else if (hasPendingDocs || hasShuftiPending) {
      calculatedStatus = 'pending';
    } else if (hasRejectedDocs) {
      calculatedStatus = 'rejected';
    } else if (manualDocs.length > 0) {
      calculatedStatus = 'pending';
    }

    // Persist new status to DB
    if (checkPgStatus()) {
      await query(`UPDATE users SET kyc_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [calculatedStatus, userId]);
    } else {
      const user = inMemoryStore.users?.find(u => String(u.id) === String(userId));
      if (user) user.kyc_status = calculatedStatus;
    }

    return calculatedStatus;
  } catch (err) {
    console.error(`Error recomputing KYC status for user #${userId}:`, err.message);
    return 'unverified';
  }
};
