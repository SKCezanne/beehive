require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'beehive_events',
    port:     Number(process.env.DB_PORT) || 3306,
  },
  dataDir: process.env.DATA_DIR || './data',
};
