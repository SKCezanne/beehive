const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function initDb() {
  const conn = await getPool();

  // Email verification table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Events table (with registration_link + created_by)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      price INT NOT NULL DEFAULT 0,
      time DATETIME NOT NULL,
      image TEXT,
      registration_link TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Safely add columns if they don't exist yet
  try { await conn.query(`ALTER TABLE events ADD COLUMN registration_link TEXT`); } catch(e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE events ADD COLUMN created_by VARCHAR(255)`); } catch(e) { /* already exists */ }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      bio TEXT,
      department VARCHAR(50),
      section VARCHAR(10),
      year INT,
      reg_number VARCHAR(50),
      interests JSON,
      linkedin VARCHAR(255),
      instagram VARCHAR(100),
      avatar TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      event_id INT NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      department VARCHAR(50),
      year INT,
      section VARCHAR(10),
      reg_number VARCHAR(50),
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_reg (email, event_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);

  // Safely add new columns to registrations if they don't exist yet
  try { await conn.query(`ALTER TABLE registrations ADD COLUMN first_name VARCHAR(100)`); } catch(e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE registrations ADD COLUMN last_name VARCHAR(100)`); } catch(e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE registrations ADD COLUMN department VARCHAR(50)`); } catch(e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE registrations ADD COLUMN year INT`); } catch(e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE registrations ADD COLUMN section VARCHAR(10)`); } catch(e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE registrations ADD COLUMN reg_number VARCHAR(50)`); } catch(e) { /* already exists */ }

  await conn.query(`DELETE FROM events WHERE month(time)*100 + day(time) < month(curdate())*100 + day(curdate())`);
}

module.exports = { getPool, initDb };
