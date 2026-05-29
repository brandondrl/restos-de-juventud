const { getSql } = require('../_db');
const { signToken } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { token, chat_id } = req.body;
  if (!token || !chat_id) return res.status(400).json({ error: 'Faltan datos' });
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE username = ${token.toLowerCase()}`;
  if (!rows.length) return res.status(401).json({ error: 'Token inválido' });
  const user = rows[0];
  await sql`UPDATE users SET telegram_chat_id = ${String(chat_id)}, telegram_linked_at = NOW()::text WHERE id = ${user.id}`;
  const jwt = signToken({ id: user.id, username: user.username });
  res.json({ ok: true, token: jwt, username: user.username });
};