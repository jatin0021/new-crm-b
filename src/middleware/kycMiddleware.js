import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

/**
 * Middleware: Enforces that the authenticated user has completed KYC verification ('verified' or 'approved').
 */
export const requireKyc = async (req, res, next) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      ok: false,
      success: false,
      message: 'Unauthorized: User authentication required',
      error: 'Unauthorized'
    });
  }

  try {
    let kycStatus = 'unverified';

    if (checkPgStatus()) {
      const result = await query(`SELECT kyc_status FROM users WHERE id = $1`, [userId]);
      kycStatus = result.rows[0]?.kyc_status || 'unverified';
    } else {
      const user = inMemoryStore.users?.find(u => u.id === userId);
      kycStatus = user?.kyc_status || 'unverified';
    }

    const isApproved = ['verified', 'approved'].includes(kycStatus.toLowerCase());

    if (!isApproved) {
      return res.status(403).json({
        ok: false,
        success: false,
        message: 'KYC Verification Required: You must complete identity verification before opening a live trading account.',
        error: 'KycRequired',
        data: { kyc_status: kycStatus }
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: 'Failed to verify KYC status',
      error: err.message
    });
  }
};

/**
 * Middleware: Enforces KYC verification UNLESS creating a Demo trading account.
 */
export const requireKycUnlessDemo = (req, res, next) => {
  const { isDemo, is_demo, account_type } = req.body || {};
  const accTypeLower = String(account_type || '').toLowerCase();
  const isDemoAccount = isDemo === true || is_demo === true || isDemo === 'true' || is_demo === 'true' || accTypeLower === 'demo';

  if (isDemoAccount) {
    return next();
  }

  return requireKyc(req, res, next);
};
