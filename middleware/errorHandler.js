const multer = require('multer');

/**
 * Global error-handling middleware.
 * Catches Multer errors and any other unhandled errors.
 */
function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: err.message || 'Server error' });
}

module.exports = errorHandler;
