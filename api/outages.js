const { getSql, initDb } = require('./_db');

module.exports = async (req, res) => {
  const sql = getSql();
  await initDb(sql);

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM outages ORDER BY start_time DESC`;
    return res.json(rows.map(r => ({
      id: r.id, start: r.start_time, end: r.end_time,
      duration_minutes: r.duration_minutes, type: r.type || 'corte', notes: r.notes
    })));
  }

  if (req.method === 'POST') {
    const { id, start, end, duration_minutes, type, notes } = req.body;
    await sql`
      INSERT INTO outages (id, start_time, end_time, duration_minutes, type, notes)
      VALUES (${id}, ${start}, ${end ?? null}, ${duration_minutes ?? null}, ${type ?? 'corte'}, ${notes ?? null})
      ON CONFLICT (id) DO UPDATE SET end_time=EXCLUDED.end_time, duration_minutes=EXCLUDED.duration_minutes
    `;
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
