const { getSql } = require('./_db');
const { requireAuth, clearCookie } = require('./_auth');
const { methodNotAllowed } = require('./_http');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return methodNotAllowed(res);
  const user = requireAuth(req, res);
  if (!user) return;
  const sql = getSql();
  await sql`DELETE FROM active_outage_v2 WHERE user_id = ${user.id}`;
  await sql`DELETE FROM outages WHERE user_id = ${user.id}`;
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  clearCookie(res);
  res.json({ ok: true });
};
