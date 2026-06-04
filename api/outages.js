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
    if (typeof id !== 'string') return res.status(400).json({ error: 'id debe ser texto' });
    if (isNaN(Date.parse(start))) return res.status(400).json({ error: 'start debe ser una fecha válida' });
    if (end != null && isNaN(Date.parse(end))) return res.status(400).json({ error: 'end debe ser una fecha válida' });
    if (duration_minutes != null && (typeof duration_minutes !== 'number' || duration_minutes < 0)) return res.status(400).json({ error: 'duration_minutes debe ser un número válido' });
    if (type != null && !['corte', 'fluctuacion'].includes(type)) return res.status(400).json({ error: 'type debe ser corte o fluctuacion' });
    if (mood != null && (!Number.isInteger(mood) || mood < 1 || mood > 10)) return res.status(400).json({ error: 'mood debe ser un entero entre 1 y 10' });
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

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id requerido' });
    await sql`DELETE FROM outages WHERE id = ${id} AND user_id = ${user.id}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
};