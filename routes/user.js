const router = require('express').Router();

const { getPool } = require('../db');
const { requireUserAuth } = require('../middleware/auth');

router.get('/my-events', requireUserAuth, async (req, res) => {
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

    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: row.price,
      time: row.time ? new Date(row.time).toISOString().slice(0, 16) : null,
      image: row.image || null,
      registration_link: row.registration_link || null,
      created_at: row.created_at,
      registration_count: row.registration_count,
    })));
  } catch (err) {
    console.error('GET my-events error:', err);
    res.status(500).json({ error: 'Failed to fetch your events' });
  }
});

router.get('/my-registrations', requireUserAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT e.id, e.name, e.description, e.category, e.price, e.time, e.image,
              e.registration_link, r.registered_at
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.email = ?
       ORDER BY e.time ASC`,
      [req.session.user.email],
    );

    res.json({
      ids: rows.map(row => row.id),
      events: rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        price: row.price,
        time: row.time ? new Date(row.time).toISOString().slice(0, 16) : null,
        image: row.image || null,
        registration_link: row.registration_link || null,
        registered_at: row.registered_at,
      })),
    });
  } catch (err) {
    console.error('GET my-registrations error:', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const pool = await getPool();
    const notifications = [];

    const [newEvents] = await pool.query(
      `SELECT id, name, time, created_at
       FROM events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY created_at DESC
       LIMIT 8`,
    );

    newEvents.forEach(event => {
      notifications.push({
        type: 'new-event',
        title: `New event added: ${event.name}`,
        eventId: event.id,
        time: event.created_at,
      });
    });

    if (req.session.user && req.session.user.role === 'user') {
      const [reminders] = await pool.query(
        `SELECT e.id, e.name, e.time
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         WHERE r.email = ?
           AND e.time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 48 HOUR)
         ORDER BY e.time ASC`,
        [req.session.user.email],
      );

      reminders.forEach(event => {
        notifications.push({
          type: 'reminder',
          title: `Upcoming: ${event.name}`,
          eventId: event.id,
          time: event.time,
        });
      });
    }

    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
    res.json(notifications.slice(0, 12));
  } catch (err) {
    console.error('GET notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
