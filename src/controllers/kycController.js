import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

export const getKycStatus = async (req, res) => {
  const userId = req.user.id;

  try {
    let kyc = null;
    let userKycStatus = 'unverified';

    if (checkPgStatus()) {
      const userRes = await query(`SELECT kyc_status FROM users WHERE id = $1`, [userId]);
      userKycStatus = userRes.rows[0]?.kyc_status || 'unverified';

      const kycRes = await query(`SELECT * FROM kyc_verification WHERE user_id = $1`, [userId]);
      kyc = kycRes.rows[0];
    } else {
      const user = inMemoryStore.users.find(u => u.id === userId);
      userKycStatus = user?.kyc_status || 'unverified';
    }

    return res.json({
      message: 'KYC status retrieved',
      data: {
        status: userKycStatus,
        verification_details: kyc
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve KYC status', error: err.message });
  }
};

export const uploadKycDocuments = async (req, res) => {
  const userId = req.user.id;
  const files = req.files || {};
  const idDoc = files.id_document ? files.id_document[0].filename : null;
  const proofAddr = files.proof_address ? files.proof_address[0].filename : null;

  try {
    if (checkPgStatus()) {
      await query(
        `INSERT INTO kyc_verification (user_id, id_document_url, proof_address_url, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (user_id) DO UPDATE SET id_document_url = $2, proof_address_url = $3, status = 'pending'`,
        [userId, idDoc, proofAddr]
      );
      await query(`UPDATE users SET kyc_status = 'pending' WHERE id = $1`, [userId]);
    } else {
      const user = inMemoryStore.users.find(u => u.id === userId);
      if (user) user.kyc_status = 'pending';
    }

    return res.status(200).json({
      message: 'KYC documents submitted successfully. Verification in progress.',
      data: { status: 'pending', id_document: idDoc, proof_address: proofAddr }
    });
  } catch (err) {
    return res.status(500).json({ message: 'KYC submission failed', error: err.message });
  }
};
