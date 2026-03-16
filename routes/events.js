const router = require('express').Router();
const { getPool }      = require('../db');
const { requireAuth, requireUserAuth }  = require('../middleware/auth');
const { upload }       = require('../middleware/upload');
const { writeEventsJson } = require('../storage');

/* ---------- helper: sync DB rows → JSON file ---------- */
async function syncEventsToJson(events) {
  try { await writeEventsJson(events); }
  catch (err) { console.error('JSON sync failed:', err.message); }
}

/* ---------- row → API shape ---------- */
function formatEvent(row) {
  return {
    id:                row.id,
    name:              row.name,
    description:       row.description,
    category:          row.category,
    price:             row.price,
    time:              row.time ? new Date(row.time).toISOString().slice(0, 16) : null,
    image:             row.image || null,
    registration_link: row.registration_link || null,
  };
}

/* ====================================================
   GET /api/events        — list all upcoming events
   ==================================================== */
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT id, name, description, category, price, time, image, registration_link
       FROM events ORDER BY time ASC`,
    );
    const events = rows.map(formatEvent);
    await syncEventsToJson(events);
    res.json(events);
  } catch (err) {
    console.error('GET events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/* ====================================================
   POST /api/events       — create event (auth required)
   ==================================================== */
router.post('/', requireUserAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, category, price, time, registration_link } = req.body;

    if (!name || !description || !category || price == null || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pool      = await getPool();
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const formatted = time.replace('T', ' ').slice(0, 19);
    const createdBy = req.session.user.email;

    const [result] = await pool.query(
      `INSERT INTO events (name, description, category, price, time, image, registration_link, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, category, Number(price), formatted, imagePath, registration_link || null, createdBy],
    );

    res.status(201).json({ message: 'Event created successfully', id: result.insertId });
  } catch (err) {
    console.error('POST event error:', err);
    res.status(500).json({ error: 'Failed to register event' });
  }
});

/* ====================================================
   GET /api/events/:id    — single event detail
   ==================================================== */
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT id, name, description, category, price, time, image, registration_link, created_by
       FROM events WHERE id = ?`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });

    const row = rows[0];
    res.json({ ...formatEvent(row), created_by: row.created_by || null });
  } catch (err) {
    console.error('GET event detail error:', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/* ====================================================
   DELETE /api/events/:id — delete own event
   ==================================================== */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const isAdmin = req.session.user.role === 'admin';
    const sql = isAdmin
      ? 'DELETE FROM events WHERE id = ?'
      : 'DELETE FROM events WHERE id = ? AND created_by = ?';
    const params = isAdmin ? [req.params.id] : [req.params.id, req.session.user.email];
    const [result] = await pool.query(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: isAdmin ? 'Event not found' : 'Event not found or not yours' });
    }
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('DELETE event error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

/* ====================================================
   GET /api/events/:id/registrations — count
   ==================================================== */
router.get('/:id/registrations', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?`,
      [req.params.id],
    );
    res.json({ event_id: Number(req.params.id), count: rows[0].count });
  } catch (err) {
    console.error('GET registration count error:', err);
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

/* ====================================================
   GET /api/events/:id/students — registered students (creator only)
   ==================================================== */
router.get('/:id/students', requireAuth, async (req, res) => {
  try {
    const pool    = await getPool();
    const eventId = req.params.id;

    const [evRows] = await pool.query('SELECT created_by FROM events WHERE id = ?', [eventId]);
    if (!evRows.length) return res.status(404).json({ error: 'Event not found' });
    if (req.session.user.role !== 'admin' && evRows[0].created_by !== req.session.user.email) {
      return res.status(403).json({ error: 'Only the event creator can view registered students' });
    }

    const [rows] = await pool.query(
      `SELECT email, first_name, last_name, department, year, section, reg_number, registered_at
       FROM registrations WHERE event_id = ? ORDER BY registered_at ASC`,
      [eventId],
    );

    const students = rows.map(r => ({
      email:        r.email,
      firstName:    r.first_name,
      lastName:     r.last_name,
      department:   r.department,
      year:         r.year,
      section:      r.section,
      regNumber:    r.reg_number,
      registeredAt: r.registered_at,
    }));

    res.json({ event_id: Number(eventId), count: students.length, students });
  } catch (err) {
    console.error('GET event students error:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

module.exports = router;
