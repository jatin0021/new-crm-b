import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

/**
 * Authentication Middleware for External CRM Interoperability API Calls
 * Validates 'X-CRM-API-Key' and 'X-CRM-API-Secret' header parameters.
 * Enables another CRM system to safely call our CRM's backend APIs.
 */
export const authenticateExternalCrm = async (req, res, next) => {
  const apiKey = req.headers['x-crm-api-key'] || req.query.api_key;
  const apiSecret = req.headers['x-crm-api-secret'] || req.query.api_secret;

  if (!apiKey || !apiSecret) {
    return res.status(401).json({
      ok: false,
      success: false,
      message: 'Access Denied: Missing X-CRM-API-Key or X-CRM-API-Secret request headers',
      data: null,
      error: 'MissingExternalApiCredentials'
    });
  }

  try {
    let keyRecord = null;

    if (checkPgStatus()) {
      const result = await query(
        `SELECT * FROM api_keys WHERE api_key = $1 AND api_secret = $2 AND is_active = TRUE`,
        [apiKey, apiSecret]
      );
      keyRecord = result.rows[0];
    } else {
      keyRecord = inMemoryStore.api_keys.find(
        (k) => k.api_key === apiKey && k.api_secret === apiSecret && k.is_active
      );
    }

    if (!keyRecord) {
      return res.status(403).json({
        ok: false,
        success: false,
        message: 'Forbidden: Invalid or inactive External CRM API key or secret',
        data: null,
        error: 'InvalidExternalApiCredentials'
      });
    }

    // Attach external CRM identity to request context
    req.externalCrm = {
      id: keyRecord.id,
      name: keyRecord.crm_name,
      permissions: keyRecord.permissions || ['all']
    };

    next();
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: 'External API authentication check failed',
      data: null,
      error: err.message
    });
  }
};
