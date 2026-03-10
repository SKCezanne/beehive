const { getPool } = require('./db');
const fetch = globalThis.fetch || require('node-fetch');
const FormData = require('form-data');

(async () => {
  try {
    const pool = await getPool();
    const email = 'testuser@srmist.edu.in';
    const otp = '123456';
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('INSERT INTO email_verifications (email, otp, expires_at) VALUES (?, ?, ?)', [email, otp, expires]);

    const verifyRes = await fetch('http://localhost:3000/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
      redirect: 'manual',
    });

    console.log('verify status', verifyRes.status);
    const cookie = verifyRes.headers.get('set-cookie');
    console.log('cookie', cookie);

    const formData = new FormData();
    formData.append('name', 'Test Event');
    formData.append('description', 'desc');
    formData.append('category', 'music');
    formData.append('price', '0');
    formData.append('time', new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16));
    formData.append('registration_link', 'https://example.com');

    const evRes = await fetch('http://localhost:3000/api/events', {
      method: 'POST',
      headers: { cookie },
      body: formData,
    });

    console.log('event create status', evRes.status);
    console.log(await evRes.text());

    const [rows] = await pool.query('SELECT * FROM events');
    console.log('events in db', rows.length);
  } catch (err) {
    console.error(err);
  }
})();
