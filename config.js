require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  // Set AUTH_ENABLED=0 to skip login, OTP, and auth checks during testing.
  authEnabled: process.env.AUTH_ENABLED !== '0',
  testUserEmail: process.env.TEST_USER_EMAIL || 'test.user@srmist.edu.in',
  testAdminEmail: process.env.TEST_ADMIN_EMAIL || 'test.admin@srmist.edu.in',
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'beehive_events',
    port:     Number(process.env.DB_PORT) || 3306,
  },
  dataDir: process.env.DATA_DIR || './data',
  // Comma-separated list of admin email addresses (e.g. ADMIN_EMAILS=admin1@school.edu,admin2@school.edu)
  adminEmails: process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean)
    : [],
};
