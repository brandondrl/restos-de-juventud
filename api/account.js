const { getSql } = require('./_db');
const { requireAuth, clearCookie } = require('./_auth');
const { methodNotAllowed } = require('./_http');
const config = require('./_config');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return methodNotAllowed(res);
  const user = requireAuth(req, res);
  if (!user) return;
  const sql = getSql();

  const [row] = await sql`SELECT telegram_chat_id FROM users WHERE id = ${user.id}`;

  await sql`DELETE FROM active_outage_v2 WHERE user_id = ${user.id}`;
  await sql`DELETE FROM outages WHERE user_id = ${user.id}`;
  await sql`DELETE FROM users WHERE id = ${user.id}`;

  if (row?.telegram_chat_id && config.BOT_URL && config.WEBHOOK_SECRET) {
    try {
      await fetch(`${config.BOT_URL}/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': config.WEBHOOK_SECRET },
        body: JSON.stringify({ chat_id: row.telegram_chat_id }),
      });
    } catch {}
  }

  clearCookie(res);
  res.json({ ok: true });
};
