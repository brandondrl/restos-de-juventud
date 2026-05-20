const { getSql, initDb } = require('./_db');
const { requireAuth } = require('./_auth');

module.exports = async (req, res) => {
  const sql = getSql();
  await initDb(sql);
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM outages WHERE user_id = ${user.id} ORDER BY start_time DESC`;
    return res.json(rows.map(row => ({
      id: row.id,
      start: row.start_time,
      end: row.end_time,
      duration_minutes: row.duration_minutes,
      type: row.type || 'corte',
      mood: row.mood || null,
      notes: row.notes,
    })));
  }

  if (req.method === 'POST') {
    const { id, start, end, duration_minutes, type, mood, notes } = req.body;
    if (!id || !start) return res.status(400).json({ error: 'id y start requeridos' });
    await sql`
      INSERT INTO outages (id, user_id, start_time, end_time, duration_minutes, type, mood, notes)
      VALUES (${id}, ${user.id}, ${start}, ${end ?? null}, ${duration_minutes ?? null}, ${type ?? 'corte'}, ${mood ?? null}, ${notes ?? null})
      ON CONFLICT (id) DO UPDATE
        SET end_time = EXCLUDED.end_time,
            duration_minutes = EXCLUDED.duration_minutes,
            mood = EXCLUDED.mood
    `;
    return res.json({ ok: true });
  }

  res.status(405).end();
};
