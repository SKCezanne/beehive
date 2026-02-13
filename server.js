console.log("🔥 CORRECT SERVER FILE IS RUNNING 🔥");
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const nodemailer = require('nodemailer');

const { getPool, initDb } = require('./db');
const { writeEventsJson } = require('./storage');
const config = require('./config');

const app = express();

/* ---------------- BASIC MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'super_secret_key_change_this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true only if using HTTPS
    httpOnly: true
  }
}));


/* ---------------- UPLOAD DIRECTORY ---------------- */
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

/* ---------------- MULTER CONFIG ---------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

/* ---------------- NODEMAILER CONFIG ---------------- */
/*
  IMPORTANT:
  Replace with your actual Gmail + App Password
*/
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'cezanneshaik@gmail.com',
    pass: 'ohxhvwvyzrnxxlly'
  }
});


/* ---------------- HELPER: JSON SYNC ---------------- */
async function syncEventsToJson(events) {
  try {
    await writeEventsJson(events);
  } catch (err) {
    console.error('JSON sync failed:', err.message);
  }
}

/* ---------------- TEST SESSION ROUTE ---------------- */
app.get('/api/test-session', (req, res) => {
  if (!req.session.views) {
    req.session.views = 1;
  } else {
    req.session.views++;
  }
  res.json({ views: req.session.views });
});

/* ---------------- SEND OTP ROUTE ---------------- */
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.endsWith('@srmist.edu.in')) {
      return res.status(400).json({ error: 'Invalid SRM email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const pool = await getPool();

    await pool.query(
      `INSERT INTO email_verifications (email, otp, expires_at)
       VALUES (?, ?, ?)`,
      [email, otp, expiresAt]
    );

    await transporter.sendMail({
      from: 'Event Hive',
      to: email,
      subject: 'Event Hive Verification Code',
      text: `Your OTP is: ${otp}. It expires in 5 minutes.`
    });

    res.json({ message: 'OTP sent successfully' });

  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT * FROM email_verifications
       WHERE email = ? AND otp = ?
       ORDER BY id DESC
       LIMIT 1`,
      [email, otp]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const record = rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    // Insert user if not exists
    await pool.query(
      `INSERT IGNORE INTO users (email, verified)
       VALUES (?, TRUE)`,
      [email]
    );

    // Create session
    req.session.user = {
      email
    };

    res.json({ message: 'Verified successfully' });

  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});
//-------------GET-----------------//
app.use(express.static(path.join(__dirname)));


/* ---------------- GET EVENTS ---------------- */
app.get('/api/events', async (req, res) => {
  
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
  `SELECT id, name, description, category, price, time, image, registration_link
   FROM events
   ORDER BY time ASC`
);



 const events = rows.map(row => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  price: row.price,
  time: row.time
    ? new Date(row.time).toISOString().slice(0, 16)
    : null,
  image: row.image || null,
  registration_link: row.registration_link || null
}));


    await syncEventsToJson(events);

    res.json(events);

  } catch (err) {
    console.error('GET events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/* ---------------- CREATE EVENT ---------------- */
app.post('/api/events', upload.single('image'), async (req, res) => {
  if (!req.session.user) {
  return res.status(401).json({ error: 'Unauthorized' });
}

  try {
    const { name, description, category, price, time, registration_link } = req.body;


    if (!name || !description || !category || price == null || !time) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    const pool = await getPool();

    let imagePath = null;
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    }

    const formattedTime = time.replace('T', ' ').slice(0, 19);

    const [result] = await pool.query(
      `INSERT INTO events (name, description, category, price, time, image, registration_link)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
  name,
  description,
  category,
  Number(price),
  formattedTime,
  imagePath,
  registration_link || null
]

    );

    res.status(201).json({
      message: 'Event created successfully',
      id: result.insertId
    });

  } catch (err) {
    console.error('POST event error:', err);
    res.status(500).json({ error: 'Failed to register event' });
  }
});

/* ---------------- SERVE FRONTEND ---------------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ---------------- START SERVER ---------------- */
async function start() {
  try {
    await initDb();

    app.listen(config.port, () => {
      console.log(`Event Hive running at http://localhost:${config.port}`);
    });

  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();
