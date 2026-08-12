export const errorHandler = (err, req, res, next) => {
  console.error('🔥 Server Error Catch-All Handler:', err);

  const statusCode = res.statusCode >= 400 ? res.statusCode : 500;

  res.status(statusCode).json({
    ok: false,
    success: false,
    message: err.message || 'Internal Server Error',
    data: null,
    error: err.name || 'ServerError'
  });
};
