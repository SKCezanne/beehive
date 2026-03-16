const router = require('express').Router();

const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

async function getEventAccess(pool, eventId, sessionUser) {
  const [events] = await pool.query(
    'SELECT id, created_by FROM events WHERE id = ? LIMIT 1',
    [eventId],
  );

  if (!events.length) {
    return { found: false };
  }

  const event = events[0];
  const isAdmin = sessionUser.role === 'admin';
  const isHost = event.created_by === sessionUser.email;

  let isRegistered = false;
  if (!isAdmin && !isHost) {
    const [registrations] = await pool.query(
      'SELECT id FROM registrations WHERE event_id = ? AND email = ? LIMIT 1',
      [eventId, sessionUser.email],
    );
    isRegistered = registrations.length > 0;
  }

  return {
    found: true,
    isAdmin,
    isHost,
    isRegistered,
    canView: isAdmin || isHost || isRegistered,
  };
}

router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const access = await getEventAccess(pool, req.params.eventId, req.session.user);

    if (!access.found) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!access.canView) {
      return res.status(403).json({ error: 'Only the host or registered users can open this event room' });
    }

    const [announcements] = await pool.query(
      `SELECT id, event_id, author_email, message, created_at
       FROM event_announcements
       WHERE event_id = ?
       ORDER BY created_at DESC`,
      [req.params.eventId],
    );

    const announcementIds = announcements.map(item => item.id);
    let replies = [];
    if (announcementIds.length) {
      const [replyRows] = await pool.query(
        `SELECT id, announcement_id, author_email, message, created_at
         FROM announcement_replies
         WHERE announcement_id IN (?)
         ORDER BY created_at ASC`,
        [announcementIds],
      );
      replies = replyRows;
    }

    const repliesByAnnouncement = new Map();
    replies.forEach(reply => {
      if (!repliesByAnnouncement.has(reply.announcement_id)) {
        repliesByAnnouncement.set(reply.announcement_id, []);
      }
      repliesByAnnouncement.get(reply.announcement_id).push(reply);
    });

    res.json({
      canAnnounce: access.isAdmin || access.isHost,
      announcements: announcements.map(item => ({
        id: item.id,
        eventId: item.event_id,
        authorEmail: item.author_email,
        message: item.message,
        createdAt: item.created_at,
        replies: (repliesByAnnouncement.get(item.id) || []).map(reply => ({
          id: reply.id,
          authorEmail: reply.author_email,
          message: reply.message,
          createdAt: reply.created_at,
        })),
      })),
    });
  } catch (err) {
    console.error('GET announcements error:', err);
    res.status(500).json({ error: 'Failed to load event announcements' });
  }
});

router.post('/:eventId', requireAuth, async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Announcement message is required' });
    }

    const pool = await getPool();
    const access = await getEventAccess(pool, req.params.eventId, req.session.user);

    if (!access.found) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!(access.isAdmin || access.isHost)) {
      return res.status(403).json({ error: 'Only the event host can post announcements' });
    }

    const [result] = await pool.query(
      `INSERT INTO event_announcements (event_id, author_email, message)
       VALUES (?, ?, ?)`,
      [req.params.eventId, req.session.user.email, message],
    );

    res.status(201).json({ message: 'Announcement posted', id: result.insertId });
  } catch (err) {
    console.error('POST announcement error:', err);
    res.status(500).json({ error: 'Failed to post announcement' });
  }
});

router.post('/reply/:announcementId', requireAuth, async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Reply message is required' });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT ea.id, ea.event_id
       FROM event_announcements ea
       WHERE ea.id = ?
       LIMIT 1`,
      [req.params.announcementId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const access = await getEventAccess(pool, rows[0].event_id, req.session.user);
    if (!access.canView) {
      return res.status(403).json({ error: 'Only the host or registered users can reply here' });
    }

    const [result] = await pool.query(
      `INSERT INTO announcement_replies (announcement_id, author_email, message)
       VALUES (?, ?, ?)`,
      [req.params.announcementId, req.session.user.email, message],
    );

    res.status(201).json({ message: 'Reply posted', id: result.insertId });
  } catch (err) {
    console.error('POST reply error:', err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

module.exports = router;
