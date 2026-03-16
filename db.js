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
      password_hash VARCHAR(255),
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { await conn.query(`ALTER TABLE email_verifications ADD COLUMN password_hash VARCHAR(255)`); } catch (e) { /* already exists */ }

  // Users table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      verified BOOLEAN DEFAULT FALSE,
      status ENUM('active', 'banned') DEFAULT 'active',
      banned_until DATETIME NULL,
      ban_reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { await conn.query(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)`); } catch (e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE users ADD COLUMN status ENUM('active', 'banned') DEFAULT 'active'`); } catch (e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE users ADD COLUMN banned_until DATETIME NULL`); } catch (e) { /* already exists */ }
  try { await conn.query(`ALTER TABLE users ADD COLUMN ban_reason TEXT NULL`); } catch (e) { /* already exists */ }

  // Admin accounts
  await conn.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
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

  await conn.query(`
    CREATE TABLE IF NOT EXISTS event_announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      author_email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS announcement_replies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      announcement_id INT NOT NULL,
      author_email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (announcement_id) REFERENCES event_announcements(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    DELETE FROM events
    WHERE YEAR(time) < YEAR(CURDATE())
       OR (YEAR(time) = YEAR(CURDATE()) AND DATE(time) < CURDATE())
  `);
}

module.exports = { getPool, initDb };
