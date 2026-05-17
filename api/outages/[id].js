const { getSql } = require('../_db');
const { requireAuth } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).end();
  const user = requireAuth(req, res);
  if (!user) return;
  const sql = getSql();
  await sql`DELETE FROM outages WHERE id = ${req.query.id} AND user_id = ${user.id}`;
  res.json({ ok: true });
};
