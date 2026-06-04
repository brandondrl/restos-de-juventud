const { getSql } = require('./_db');
const { requireAuth } = require('./_auth');
const { badRequest, methodNotAllowed } = require('./_http');

module.exports = async (req, res) => {
  const sql = getSql();
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM active_outage_v2 WHERE user_id = ${user.id}`;
    return res.json(rows.length ? { id: rows[0].outage_id, start: rows[0].start_time } : null);
  }
  if (req.method === 'POST') {
    const { id, start } = req.body;
    if (!id || !start) return badRequest(res, 'id y start requeridos');
    if (typeof id !== 'string') return badRequest(res, 'id debe ser texto');
    if (isNaN(Date.parse(start))) return badRequest(res, 'start debe ser una fecha válida');
    await sql`INSERT INTO active_outage_v2 (user_id, outage_id, start_time) VALUES (${user.id}, ${id}, ${start}) ON CONFLICT (user_id) DO UPDATE SET outage_id=EXCLUDED.outage_id, start_time=EXCLUDED.start_time`;
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    await sql`DELETE FROM active_outage_v2 WHERE user_id = ${user.id}`;
    return res.json({ ok: true });
  }
  methodNotAllowed(res);
};
