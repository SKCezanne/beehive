const { getPool } = require('../db');
const config = require('../config');

function setBypassSession(req, role = 'user') {
  if (!req.session.user) {
    req.session.user = {
      email: role === 'admin' ? config.testAdminEmail : config.testUserEmail,
      role,
    };
  }
}

function requireAuth(req, res, next) {
  if (!config.authEnabled) {
    setBypassSession(req);
    return next();
  }

  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

async function requireUserAuth(req, res, next) {
  if (!config.authEnabled) {
    setBypassSession(req, 'user');
    return next();
  }

  if (!req.session.user || req.session.user.role !== 'user') {
    return res.status(401).json({ error: 'User login required' });
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT status, banned_until, ban_reason FROM users WHERE email = ?',
      [req.session.user.email],
    );

    if (!rows.length) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User account not found' });
    }

    const user = rows[0];
    const bannedUntil = user.banned_until ? new Date(user.banned_until) : null;
    const isStillBanned = user.status === 'banned' && (!bannedUntil || bannedUntil > new Date());

    if (isStillBanned) {
      req.session.destroy(() => {});
      return res.status(403).json({
        error: user.ban_reason || 'Your account has been banned',
        bannedUntil: bannedUntil ? bannedUntil.toISOString() : null,
      });
    }

    if (user.status === 'banned' && bannedUntil && bannedUntil <= new Date()) {
      await pool.query(
        `UPDATE users
         SET status = 'active', banned_until = NULL, ban_reason = NULL
         WHERE email = ?`,
        [req.session.user.email],
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}

function requireAdminAuth(req, res, next) {
  if (!config.authEnabled) {
    setBypassSession(req, 'admin');
    return next();
  }

  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireUserAuth, requireAdminAuth };
