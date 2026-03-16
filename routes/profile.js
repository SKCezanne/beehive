const router = require('express').Router();
const { getPool }     = require('../db');
const { requireUserAuth } = require('../middleware/auth');
const { upload }      = require('../middleware/upload');

/* ====================================================
   GET /api/profile — fetch current user's profile
   ==================================================== */
router.get('/', requireUserAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM profiles WHERE email = ?', [req.session.user.email]);

    if (!rows.length) return res.json({ email: req.session.user.email });

    const p = rows[0];
    res.json({
      email:      p.email,
      firstName:  p.first_name,
      lastName:   p.last_name,
      bio:        p.bio,
      department: p.department,
      section:    p.section,
      year:       p.year,
      regNumber:  p.reg_number,
      interests:  p.interests || [],
      linkedin:   p.linkedin,
      instagram:  p.instagram,
      avatar:     p.avatar,
    });
  } catch (err) {
    console.error('GET profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/* ====================================================
   POST /api/profile — create / update profile
   ==================================================== */
router.post('/', requireUserAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { firstName, lastName, bio, department, section, year, regNumber, linkedin, instagram, interests } = req.body;
    const email = req.session.user.email;

    let avatarPath = req.file ? `/uploads/${req.file.filename}` : null;

    const pool = await getPool();
    const [existing] = await pool.query('SELECT id, avatar FROM profiles WHERE email = ?', [email]);

    let parsedInterests = [];
    try { parsedInterests = JSON.parse(interests || '[]'); } catch (_) { /* ignore */ }

    if (existing.length) {
      const updates = [
        'first_name = ?', 'last_name = ?', 'bio = ?', 'department = ?',
        'section = ?', 'year = ?', 'reg_number = ?', 'interests = ?',
        'linkedin = ?', 'instagram = ?',
      ];
      const values = [
        firstName || null, lastName || null, bio || null, department || null,
        section || null, year ? Number(year) : null, regNumber || null,
        JSON.stringify(parsedInterests), linkedin || null, instagram || null,
      ];

      if (avatarPath) {
        updates.push('avatar = ?');
        values.push(avatarPath);
      }

      values.push(email);
      await pool.query(`UPDATE profiles SET ${updates.join(', ')} WHERE email = ?`, values);
    } else {
      await pool.query(
        `INSERT INTO profiles
           (email, first_name, last_name, bio, department, section, year, reg_number, interests, linkedin, instagram, avatar)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          email, firstName || null, lastName || null, bio || null,
          department || null, section || null, year ? Number(year) : null,
          regNumber || null, JSON.stringify(parsedInterests),
          linkedin || null, instagram || null, avatarPath,
        ],
      );
    }

    res.json({ message: 'Profile saved' });
  } catch (err) {
    console.error('POST profile error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/* ====================================================
   GET /api/profile/stats — events posted & joined
   ==================================================== */
router.get('/stats', requireUserAuth, async (req, res) => {
  try {
    const pool  = await getPool();
    const email = req.session.user.email;

    const [[posted]] = await pool.query('SELECT COUNT(*) AS count FROM events WHERE created_by = ?', [email]);
    const [[joined]] = await pool.query('SELECT COUNT(*) AS count FROM registrations WHERE email = ?', [email]);

    res.json({ eventsPosted: posted.count, eventsJoined: joined.count });
  } catch (err) {
    console.error('GET profile stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
