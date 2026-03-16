const crypto = require('crypto');
const router = require('express').Router();
const nodemailer = require('nodemailer');

const { getPool } = require('../db');
const config = require('../config');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER || 'cezanneshaik@gmail.com',
    pass: process.env.MAIL_PASS || 'ohxhvwvyzrnxxlly',
  },
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function verifyStoredSecret(inputPassword, storedValue) {
  if (!storedValue) return false;
  if (storedValue.includes(':')) {
    return verifyPassword(inputPassword, storedValue);
  }
  return inputPassword === storedValue;
}

function getBanState(user) {
  const bannedUntil = user.banned_until ? new Date(user.banned_until) : null;
  const isBanned = user.status === 'banned' && (!bannedUntil || bannedUntil > new Date());
  return {
    isBanned,
    bannedUntil: bannedUntil ? bannedUntil.toISOString() : null,
    banReason: user.ban_reason || null,
  };
}

function ensureBypassSession(req, role = 'user') {
  if (!req.session.user) {
    req.session.user = {
      email: role === 'admin' ? config.testAdminEmail : config.testUserEmail,
      role,
    };
  }
}

router.get('/me', (req, res) => {
  if (!config.authEnabled) {
    ensureBypassSession(req);
  }

  if (!req.session.user) {
    return res.status(401).json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    email: req.session.user.email,
    role: req.session.user.role,
    isAdmin: req.session.user.role === 'admin',
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

router.post('/login-user', async (req, res) => {
  if (!config.authEnabled) {
    ensureBypassSession(req);
    return res.json({ message: 'Authentication bypass is enabled', skipped: true, role: 'user' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = await getPool();
    const [users] = await pool.query(
      'SELECT email, password_hash, status, banned_until, ban_reason FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (!users.length) {
      return res.status(404).json({ error: 'No account found. Create one first.' });
    }

    const user = users[0];
    const banState = getBanState(user);
    if (banState.isBanned) {
      return res.status(403).json({
        error: banState.banReason || 'Your account is currently banned',
        bannedUntil: banState.bannedUntil,
      });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    req.session.user = { email, role: 'user' };
    res.json({ message: 'Signed in successfully', role: 'user', isAdmin: false });
  } catch (err) {
    console.error('User login error:', err);
    res.status(500).json({ error: 'Sign in failed' });
  }
});

router.post('/send-otp', async (req, res) => {
  if (!config.authEnabled) {
    ensureBypassSession(req);
    return res.json({
      message: 'Authentication bypass is enabled',
      skipped: true,
      role: 'user',
      email: req.session.user.email,
    });
  }

  try {
    const { email, password, action = 'signup' } = req.body;

    if (!email || !email.endsWith('@srmist.edu.in')) {
      return res.status(400).json({ error: 'Use a valid college email address' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const pool = await getPool();
    const [users] = await pool.query(
      'SELECT email, password_hash, status, banned_until, ban_reason FROM users WHERE email = ?',
      [email],
    );

    if (action !== 'signup') {
      return res.status(400).json({ error: 'OTP verification is only required while creating an account' });
    }

    if (users.length) {
      return res.status(409).json({ error: 'Account already exists. Please sign in instead.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const passwordHash = hashPassword(password);

    await pool.query(
      `INSERT INTO email_verifications (email, otp, password_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [email, otp, passwordHash, expiresAt],
    );

    await transporter.sendMail({
      from: process.env.MAIL_USER || 'Event Hive',
      to: email,
      subject: 'Event Hive Verification Code',
      text: `Your Event Hive OTP is ${otp}. It will expire in 5 minutes.`,
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

router.post('/verify-otp', async (req, res) => {
  if (!config.authEnabled) {
    ensureBypassSession(req);
    return res.json({
      message: 'Authentication bypass is enabled',
      skipped: true,
      role: 'user',
      isAdmin: false,
    });
  }

  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT email, otp, password_hash, expires_at
       FROM email_verifications
       WHERE email = ? AND otp = ?
       ORDER BY id DESC
       LIMIT 1`,
      [email, otp],
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const verification = rows[0];
    if (new Date(verification.expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    const [existingUsers] = await pool.query(
      'SELECT email FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (!existingUsers.length) {
      await pool.query(
        `INSERT INTO users (email, password_hash, verified, status, banned_until, ban_reason)
         VALUES (?, ?, TRUE, 'active', NULL, NULL)`,
        [email, verification.password_hash],
      );
    } else {
      await pool.query(
        'UPDATE users SET verified = TRUE WHERE email = ?',
        [email],
      );
    }

    await pool.query('DELETE FROM email_verifications WHERE email = ?', [email]);

    req.session.user = { email, role: 'user' };
    res.json({ message: 'Verified successfully', role: 'user', isAdmin: false });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/admin/login', async (req, res) => {
  if (!config.authEnabled) {
    ensureBypassSession(req, 'admin');
    return res.json({
      message: 'Authentication bypass is enabled',
      skipped: true,
      role: 'admin',
      isAdmin: true,
    });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT id, email, password, created_at FROM admins WHERE email = ? LIMIT 1',
      [email],
    );

    if (!rows.length || !verifyStoredSecret(password, rows[0].password)) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    req.session.user = { email: rows[0].email, role: 'admin' };
    res.json({ message: 'Admin login successful', role: 'admin', isAdmin: true });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

module.exports = router;
