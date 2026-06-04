const { getSql } = require('./_db');
const { requireAuth } = require('./_auth');
const { badRequest, methodNotAllowed } = require('./_http');

module.exports = async (req, res) => {
  const sql = getSql();
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
    if (!id || !start) return badRequest(res, 'id y start requeridos');
    if (typeof id !== 'string') return badRequest(res, 'id debe ser texto');
    if (isNaN(Date.parse(start))) return badRequest(res, 'start debe ser una fecha válida');
    if (end != null && isNaN(Date.parse(end))) return badRequest(res, 'end debe ser una fecha válida');
    if (duration_minutes != null && (typeof duration_minutes !== 'number' || duration_minutes < 0)) return badRequest(res, 'duration_minutes debe ser un número válido');
    if (type != null && !['corte', 'fluctuacion'].includes(type)) return badRequest(res, 'type debe ser corte o fluctuacion');
    if (mood != null && (!Number.isInteger(mood) || mood < 1 || mood > 10)) return badRequest(res, 'mood debe ser un entero entre 1 y 10');
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
    if (!id) return badRequest(res, 'id requerido');
    await sql`DELETE FROM outages WHERE id = ${id} AND user_id = ${user.id}`;
    return res.json({ ok: true });
  }

  methodNotAllowed(res);
};