const express = require('express');
const cors = require('cors');
const path = require('path');
const { getPool, initDb } = require('./db');
const { writeEventsJson } = require('./storage');
const config = require('./config');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

async function syncEventsToJson(events) {
  try {
    await writeEventsJson(events);
  } catch (err) {
    console.error('Failed to sync events to JSON:', err.message);
  }
}

// GET /api/events - fetch all events from MySQL and sync to JSON
app.get('/api/events', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT id, name, description, category, price, time, image, created_at FROM events ORDER BY time ASC'
    );
    const events = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: row.price,
      time: row.time ? new Date(row.time).toISOString().slice(0, 16) : null,
      image: row.image || null,
    }));
    await syncEventsToJson(events);
    res.json(events);
  } catch (err) {
    console.error('GET /api/events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/events - register new event (from register.html)
app.post('/api/events', async (req, res) => {
  try {
    const { name, description, category, price, time, image } = req.body;
    if (!name || !description || !category || price == null || !time) {
      return res.status(400).json({
        error: 'Missing required fields: name, description, category, price, time',
      });
    }
    const pool = await getPool();
    const [result] = await pool.query(
      `INSERT INTO events (name, description, category, price, time, image)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        category,
        Number(price),
        time.replace('T', ' ').slice(0, 19),
        image || null,
      ]
    );
    const [rows] = await pool.query(
      'SELECT id, name, description, category, price, time, image FROM events WHERE id = ?',
      [result.insertId]
    );
    const event = rows[0];
    const formatted = {
      id: event.id,
      name: event.name,
      description: event.description,
      category: event.category,
      price: event.price,
      time: event.time ? new Date(event.time).toISOString().slice(0, 16) : null,
      image: event.image || null,
    };
    const [allRows] = await pool.query(
      'SELECT id, name, description, category, price, time, image FROM events ORDER BY time ASC'
    );
    const allEvents = allRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: row.price,
      time: row.time ? new Date(row.time).toISOString().slice(0, 16) : null,
      image: row.image || null,
    }));
    await syncEventsToJson(allEvents);
    res.status(201).json(formatted);
  } catch (err) {
    console.error('POST /api/events error:', err);
    res.status(500).json({ error: 'Failed to register event' });
  }
});

// Serve frontend (index.html at /, register.html at /register.html, etc.)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function start() {
  try {
    await initDb();
    app.listen(config.port, () => {
      console.log(`Event Hive server running at http://localhost:${config.port}`);
      console.log('MySQL backend + JSON sync in data/events.json');
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();
