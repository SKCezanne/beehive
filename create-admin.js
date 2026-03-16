const { getPool } = require('./db');

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node create-admin.js <email> <password>');
    process.exit(1);
  }

  const pool = await getPool();
  await pool.query(
    `INSERT INTO admins (email, password)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       password = VALUES(password)`,
    [email, password],
  );

  console.log(`Admin account ready for ${email}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
