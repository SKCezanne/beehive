const express = require('express');
const cors    = require('cors');
const path    = require('path');
const session = require('express-session');

const { initDb }   = require('./db');
const config       = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { uploadDir } = require('./middleware/upload');

/* ---------- Route modules ---------- */
const authRoutes     = require('./routes/auth');
const eventRoutes    = require('./routes/events');
const profileRoutes  = require('./routes/profile');
const cartRoutes     = require('./routes/cart');
const calendarRoutes = require('./routes/calendar');
const userRoutes     = require('./routes/user');

const app = express();

/* ================ MIDDLEWARE ================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'super_secret_key_change_this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true },
}));

/* ================ STATIC FILES ================ */
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname)));

/* ================ API ROUTES ================ */
app.use('/api',          authRoutes);      // /api/me, /api/logout, /api/send-otp, /api/verify-otp
app.use('/api/events',   eventRoutes);     // /api/events, /api/events/:id, etc.
app.use('/api/profile',  profileRoutes);   // /api/profile, /api/profile/stats
app.use('/api/cart',     cartRoutes);      // /api/cart, /api/cart/:eventId
app.use('/api/calendar', calendarRoutes);  // /api/calendar/:year/:month
app.use('/api',          userRoutes);      // /api/my-events, /api/my-registrations

/* ================ FRONTEND ================ */
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'authentication.html')));

/* ================ ERROR HANDLER ================ */
app.use(errorHandler);

/* ================ START ================ */
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
