const bcrypt = require('bcryptjs');
const { getSql, initDb } = require('../_db');
const { signToken, setCookie } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const sql = getSql();
  await initDb(sql);

  const { username, password, city = '', zone = '' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  if (username.length < 3) return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Solo letras, números y guión bajo' });

  const exists = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()}`;
  if (exists.length) return res.status(409).json({ error: 'Ese usuario ya existe' });

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const password_hash = await bcrypt.hash(password, 10);

  await sql`
    INSERT INTO users (id, username, password_hash, city, zone)
    VALUES (${id}, ${username.toLowerCase()}, ${password_hash}, ${city}, ${zone})
  `;

  const token = signToken({ id, username: username.toLowerCase() });
  setCookie(res, token);
  res.json({ ok: true, user: { id, username: username.toLowerCase(), city, zone, is_public: true } });
};
