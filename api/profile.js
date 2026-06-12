const bcrypt = require('bcryptjs');
const { getSql } = require('./_db');
const { requireAuth } = require('./_auth');
const { badRequest, notFound, methodNotAllowed } = require('./_http');

module.exports = async (req, res) => {
  const sql = getSql();
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const [profile] = await sql`
      SELECT id, username, city, zone, is_public, created_at,
             (telegram_chat_id IS NOT NULL) AS has_telegram
      FROM users WHERE id = ${user.id}
    `;
    if (!profile) return notFound(res, 'No encontrado');
    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE type = 'corte' AND end_time IS NOT NULL)::int        AS total_cortes,
        COALESCE(SUM(duration_minutes) FILTER (WHERE type = 'corte'), 0)::int       AS total_mins,
        COUNT(*) FILTER (WHERE type = 'fluctuacion')::int                           AS total_flucs
      FROM outages WHERE user_id = ${user.id}
    `;
    return res.json({ ...profile, stats });
  }

  if (req.method === 'PUT') {
    const { city, zone, is_public, currentPassword, newPassword } = req.body;
    if (is_public !== undefined && typeof is_public !== 'boolean') return badRequest(res, 'is_public debe ser booleano');
    if (city !== undefined && typeof city !== 'string') return badRequest(res, 'city debe ser texto');
    if (zone !== undefined && typeof zone !== 'string') return badRequest(res, 'zone debe ser texto');
    if (city && city.length > 60) return badRequest(res, 'La ciudad no puede superar 60 caracteres');
    if (zone && zone.length > 30) return badRequest(res, 'La zona no puede superar 30 caracteres');
    await sql`
      UPDATE users SET city = ${city || ''}, zone = ${zone || ''}, is_public = ${is_public ?? true}
      WHERE id = ${user.id}
    `;
    if (newPassword) {
      if (!currentPassword) return badRequest(res, 'Contraseña actual requerida');
      if (newPassword.length < 6) return badRequest(res, 'Mínimo 6 caracteres');
      const [row] = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
      const valid = await bcrypt.compare(currentPassword, row.password_hash);
      if (!valid) return badRequest(res, 'Contraseña actual incorrecta');
      const hash = await bcrypt.hash(newPassword, 10);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user.id}`;
    }
    return res.json({ ok: true });
  }

  methodNotAllowed(res);
};
