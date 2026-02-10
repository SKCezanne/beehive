const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

const eventsPath = path.join(config.dataDir, 'events.json');

async function ensureDataDir() {
  await fs.mkdir(config.dataDir, { recursive: true });
}

async function writeEventsJson(events) {
  await ensureDataDir();
  await fs.writeFile(eventsPath, JSON.stringify(events, null, 2), 'utf8');
}

async function readEventsJson() {
  try {
    const data = await fs.readFile(eventsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = { writeEventsJson, readEventsJson };
