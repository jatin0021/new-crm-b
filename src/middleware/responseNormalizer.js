/**
 * Global API Response Normalizer Middleware
 * Conforms strictly to Blueprint Section 2.1 JSON Schema Contract:
 * Success: { ok: true, success: true, message: "...", data: {...}, error: null }
 * Error:   { ok: false, success: false, message: "...", data: null, error: "..." }
 */
export const responseNormalizer = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // If body is already formatted with ok/success contract, pass it straight through
    if (body && typeof body === 'object' && ('ok' in body || 'success' in body)) {
      return originalJson(body);
    }

    const isError = res.statusCode >= 400;

    let normalized = {};

    if (isError) {
      const errorMessage = typeof body === 'string' 
        ? body 
        : (body?.message || body?.error || 'An error occurred during request processing');

      normalized = {
        ok: false,
        success: false,
        message: errorMessage,
        data: null,
        error: errorMessage
      };
    } else {
      let message = 'Operation completed successfully';
      let data = body;

      if (body && typeof body === 'object' && body.message && body.data !== undefined) {
        message = body.message;
        data = body.data;
      } else if (body && typeof body === 'object' && body.message && Object.keys(body).length === 1) {
        message = body.message;
        data = null;
      }

      normalized = {
        ok: true,
        success: true,
        message: message,
        data: data,
        error: null
      };
    }

    return originalJson(normalized);
  };

  next();
};
