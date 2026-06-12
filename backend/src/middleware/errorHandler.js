// ─── Error Handler Middleware ─────────────────────────────────────────────────
function errorHandler(err, req, res, next) {
  // Validation errors from Joi
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.details ? err.details.map(d => d.message) : [err.message],
    });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'Data sudah ada / duplikat.',
      detail: err.detail,
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(409).json({
      success: false,
      error: 'Reference Error',
      message: 'Data terkait tidak ditemukan.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Unauthorized', message: err.message });
  }

  // Default 500
  const status = err.status || err.statusCode || 500;
  console.error(`[${status}] ${req.method} ${req.path} —`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  return res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Wrap async route handlers so errors propagate to errorHandler.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Create a simple HTTP error.
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, asyncHandler, createError };
