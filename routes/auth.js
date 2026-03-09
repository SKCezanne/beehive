const router  = require('express').Router();
const nodemailer = require('nodemailer');
const { getPool } = require('../db');

/* ---------- Nodemailer transporter ---------- */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER || 'cezanneshaik@gmail.com',
    pass: process.env.MAIL_PASS || 'ohxhvwvyzrnxxlly',
  },
});

/* ---------- GET /api/me – session check ---------- */
router.get('/me', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ loggedIn: false });
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT 1 FROM admins WHERE email = ? LIMIT 1', [req.session.user.email]);
    const isAdmin = rows.length > 0;
    if (isAdmin) req.session.isAdmin = true;
    res.json({ loggedIn: true, email: req.session.user.email, isAdmin });
  } catch (err) {
    console.error('GET /api/me admin check error:', err);
    res.json({ loggedIn: true, email: req.session.user.email, isAdmin: false });
  }
});

/* ---------- POST /api/logout ---------- */
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

/* ---------- POST /api/send-otp ---------- */
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.endsWith('@srmist.edu.in')) {
      return res.status(400).json({ error: 'Invalid SRM email' });
    }

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    const pool = await getPool();
    await pool.query(
      `INSERT INTO email_verifications (email, otp, expires_at) VALUES (?, ?, ?)`,
      [email, otp, expiresAt],
    );

    await transporter.sendMail({
      from: 'Event Hive',
      to: email,
      subject: 'Event Hive Verification Code',
      text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/* ---------- POST /api/verify-otp ---------- */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT * FROM email_verifications
       WHERE email = ? AND otp = ?
       ORDER BY id DESC LIMIT 1`,
      [email, otp],
    );

    if (!rows.length) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date(rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    // Upsert user
    await pool.query(
      `INSERT IGNORE INTO users (email, verified) VALUES (?, TRUE)`,
      [email],
    );

    // Check if this user is also an admin
    const [adminRows] = await pool.query('SELECT 1 FROM admins WHERE email = ? LIMIT 1', [email]);
    const isAdmin = adminRows.length > 0;

    // Create session
    req.session.user = { email };
    if (isAdmin) req.session.isAdmin = true;

    res.json({ message: 'Verified successfully', isAdmin });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* ---------- POST /api/admin/login ---------- */
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT password FROM admins WHERE email = ? LIMIT 1',
      [email],
    );

    if (!rows.length || rows[0].password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { email };
    req.session.isAdmin = true;

    res.json({ message: 'Admin login successful', isAdmin: true });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/* ---------- GET /api/test-session ---------- */
router.get('/test-session', (req, res) => {
  req.session.views = (req.session.views || 0) + 1;
  res.json({ views: req.session.views });
});

module.exports = router;
