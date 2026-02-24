const router = require('express').Router();
const { getPool }     = require('../db');
const { requireAuth } = require('../middleware/auth');

/* ====================================================
   GET /api/cart — registered events for current user
   ==================================================== */
router.get('/', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT e.id AS event_id, e.name, e.description, e.category, e.price, e.time,
              e.image, e.registration_link, r.registered_at
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.email = ?
       ORDER BY e.time ASC`,
      [req.session.user.email],
    );

    const events = rows.map(row => ({
      event_id:          row.event_id,
      name:              row.name,
      description:       row.description,
      category:          row.category,
      price:             row.price,
      time:              row.time ? new Date(row.time).toISOString().slice(0, 16) : null,
      image:             row.image || null,
      registration_link: row.registration_link || null,
      registered_at:     row.registered_at,
    }));

    res.json(events);
  } catch (err) {
    console.error('GET cart error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

/* ====================================================
   POST /api/cart/:eventId — register for an event
   ==================================================== */
router.post('/:eventId', requireAuth, async (req, res) => {
  try {
    const pool  = await getPool();
    const email = req.session.user.email;

    // Pull student profile details
    let firstName = null, lastName = null, department = null,
        year = null, section = null, regNumber = null;

    const [profiles] = await pool.query(
      'SELECT first_name, last_name, department, year, section, reg_number FROM profiles WHERE email = ?',
      [email],
    );
    if (profiles.length) {
      const p    = profiles[0];
      firstName  = p.first_name;
      lastName   = p.last_name;
      department = p.department;
      year       = p.year;
      section    = p.section;
      regNumber  = p.reg_number;
    }

    await pool.query(
      `INSERT IGNORE INTO registrations (email, event_id, first_name, last_name, department, year, section, reg_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, req.params.eventId, firstName, lastName, department, year, section, regNumber],
    );

    res.json({ message: 'Registered successfully' });
  } catch (err) {
    console.error('POST cart error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

/* ====================================================
   DELETE /api/cart/:eventId — unregister from event
   ==================================================== */
router.delete('/:eventId', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query(
      `DELETE FROM registrations WHERE email = ? AND event_id = ?`,
      [req.session.user.email, req.params.eventId],
    );
    res.json({ message: 'Removed' });
  } catch (err) {
    console.error('DELETE cart error:', err);
    res.status(500).json({ error: 'Failed to remove' });
  }
});

module.exports = router;
