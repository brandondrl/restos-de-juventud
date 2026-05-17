const { getSql, initDb } = require('./_db');
const { requireAuth } = require('./_auth');

module.exports = async (req, res) => {
  const sql = getSql();
  await initDb(sql);
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM outages WHERE user_id = ${user.id} ORDER BY start_time DESC`;
    return res.json(rows.map(r => ({
      id: r.id, start: r.start_time, end: r.end_time,
      duration_minutes: r.duration_minutes, type: r.type || 'corte', notes: r.notes
    })));
  }

  if (req.method === 'POST') {
    const { id, start, end, duration_minutes, type, notes } = req.body;
    if (!id || !start) return res.status(400).json({ error: 'id y start requeridos' });
    await sql`
      INSERT INTO outages (id, user_id, start_time, end_time, duration_minutes, type, notes)
      VALUES (${id}, ${user.id}, ${start}, ${end ?? null}, ${duration_minutes ?? null}, ${type ?? 'corte'}, ${notes ?? null})
      ON CONFLICT (id) DO UPDATE
        SET end_time = EXCLUDED.end_time,
            duration_minutes = EXCLUDED.duration_minutes
    `;
    return res.json({ ok: true });
  }

  res.status(405).end();
};
