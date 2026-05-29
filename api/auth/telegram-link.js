const { getSql } = require('../_db');
const { requireAuth } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res);
  if (!user) return;
  const { chat_id } = req.body;
  if (!chat_id) return res.status(400).json({ error: 'chat_id requerido' });
  const sql = getSql();
  await sql`UPDATE users SET telegram_chat_id = ${String(chat_id)}, telegram_linked_at = NOW()::text WHERE id = ${user.id}`;
  res.json({ ok: true });
};