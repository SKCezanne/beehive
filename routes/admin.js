const router = require('express').Router();

const { getPool } = require('../db');
const { requireAdminAuth } = require('../middleware/auth');

router.use(requireAdminAuth);

router.get('/summary', async (_req, res) => {
  try {
    const pool = await getPool();
    const [[users]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[events]] = await pool.query('SELECT COUNT(*) AS count FROM events');
    const [[registrations]] = await pool.query('SELECT COUNT(*) AS count FROM registrations');
    const [[bannedUsers]] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM users
       WHERE status = 'banned' AND (banned_until IS NULL OR banned_until > NOW())`,
    );

    res.json({
      users: users.count,
      events: events.count,
      registrations: registrations.count,
      bannedUsers: bannedUsers.count,
    });
  } catch (err) {
    console.error('GET admin summary error:', err);
    res.status(500).json({ error: 'Failed to fetch admin summary' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT u.email, u.verified, u.status, u.banned_until, u.ban_reason, u.created_at,
              p.first_name, p.last_name, p.department, p.year,
              (SELECT COUNT(*) FROM events e WHERE e.created_by = u.email) AS hosted_count,
              (SELECT COUNT(*) FROM registrations r WHERE r.email = u.email) AS registered_count
       FROM users u
       LEFT JOIN profiles p ON p.email = u.email
       ORDER BY u.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('GET admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users/:email/ban', async (req, res) => {
  try {
    const pool = await getPool();
    const { mode, days, reason } = req.body;
    const email = decodeURIComponent(req.params.email);

    const bannedUntil = mode === 'permanent' ? null : new Date(Date.now() + (Number(days) || 1) * 24 * 60 * 60 * 1000);

    const [result] = await pool.query(
      `UPDATE users
       SET status = 'banned', banned_until = ?, ban_reason = ?
       WHERE email = ?`,
      [bannedUntil, reason || null, email],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User banned successfully' });
  } catch (err) {
    console.error('POST admin ban error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:email/unban', async (req, res) => {
  try {
    const pool = await getPool();
    const email = decodeURIComponent(req.params.email);
    const [result] = await pool.query(
      `UPDATE users
       SET status = 'active', banned_until = NULL, ban_reason = NULL
       WHERE email = ?`,
      [email],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User unbanned successfully' });
  } catch (err) {
    console.error('POST admin unban error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

router.get('/events', async (_req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT e.id, e.name, e.category, e.price, e.time, e.created_by, e.created_at,
              (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registration_count
       FROM events e
       ORDER BY e.time ASC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('GET admin events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;
