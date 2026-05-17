const bcrypt = require('bcryptjs');
const { getSql, initDb } = require('../_db');
const { signToken, setCookie } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const sql = getSql();
  await initDb(sql);

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Datos requeridos' });

  const rows = await sql`SELECT * FROM users WHERE username = ${username.toLowerCase()}`;
  if (!rows.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const token = signToken({ id: user.id, username: user.username });
  setCookie(res, token);
  res.json({ ok: true, user: { id: user.id, username: user.username, city: user.city, zone: user.zone, is_public: user.is_public } });
};
