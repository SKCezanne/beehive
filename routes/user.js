const router = require('express').Router();
const { getPool }     = require('../db');
const { requireAuth } = require('../middleware/auth');

/* ====================================================
   GET /api/my-events — events the current user created
   ==================================================== */
router.get('/my-events', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT e.id, e.name, e.description, e.category, e.price, e.time,
              e.image, e.registration_link, e.created_at,
              (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registration_count
       FROM events e
       WHERE e.created_by = ?
       ORDER BY e.time ASC`,
      [req.session.user.email],
    );

    const events = rows.map(row => ({
      id:                 row.id,
      name:               row.name,
      description:        row.description,
      category:           row.category,
      price:              row.price,
      time:               row.time ? new Date(row.time).toISOString().slice(0, 16) : null,
      image:              row.image || null,
      registration_link:  row.registration_link || null,
      created_at:         row.created_at,
      registration_count: row.registration_count,
    }));

    res.json(events);
  } catch (err) {
    console.error('GET my-events error:', err);
    res.status(500).json({ error: 'Failed to fetch your events' });
  }
});

/* ====================================================
   GET /api/my-registrations — event IDs user registered for
   ==================================================== */
router.get('/my-registrations', async (req, res) => {
  if (!req.session.user) return res.json({ ids: [] });
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT event_id FROM registrations WHERE email = ?',
      [req.session.user.email],
    );
    res.json({ ids: rows.map(r => r.event_id) });
  } catch (err) {
    console.error('GET my-registrations error:', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

module.exports = router;
