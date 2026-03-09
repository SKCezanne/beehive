/**
 * Authentication middleware
 * Checks if a user session exists before allowing access to protected routes.
 */
const { getPool } = require('../db');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  if (req.session.isAdmin) {
    return next();
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT 1 FROM admins WHERE email = ? LIMIT 1', [req.session.user.email]);
    if (!rows.length) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.session.isAdmin = true;
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { requireAuth, requireAdmin };
