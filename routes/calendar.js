const router = require('express').Router();
const { getPool } = require('../db');

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
   GET /api/calendar/:year/:month — events for a month
   ==================================================== */
router.get('/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT id, name, description, category, price, time, image, registration_link
       FROM events
       WHERE YEAR(time) = ? AND MONTH(time) = ?
       ORDER BY time ASC`,
      [Number(year), Number(month)],
    );
    res.json(rows.map(formatEvent));
  } catch (err) {
    console.error('GET calendar error:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

module.exports = router;
