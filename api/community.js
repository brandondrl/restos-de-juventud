const { getSql } = require('./_db');
const { requireAuth } = require('./_auth');
const { getTodayStartISO } = require('./_timezone');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res);
  if (!user) return;
  const sql = getSql();

  const todayISO = getTodayStartISO();

  const active = await sql`
    SELECT u.username, u.city, u.zone, a.start_time
    FROM active_outage_v2 a
    JOIN users u ON u.id = a.user_id
    WHERE u.is_public = true
    ORDER BY a.start_time ASC
  `;

  const todayOutages = await sql`
    SELECT
      u.city,
      COALESCE(NULLIF(u.zone,''), 'Sin zona') AS zone,
      o.start_time,
      o.end_time,
      o.duration_minutes
    FROM outages o
    JOIN users u ON u.id = o.user_id
    WHERE u.is_public = true
      AND o.type = 'corte'
      AND o.start_time >= ${todayISO}
      AND o.end_time IS NOT NULL
    ORDER BY u.city, u.zone, o.start_time ASC
  `;

  const cityUsers = await sql`
    SELECT city, COUNT(*)::int AS total FROM users
    WHERE is_public = true AND city != ''
    GROUP BY city ORDER BY total DESC
  `;

  const totals = await sql`
    SELECT COUNT(DISTINCT u.id)::int AS total_users, COUNT(DISTINCT a.user_id)::int AS active_now
    FROM users u
    LEFT JOIN active_outage_v2 a ON a.user_id = u.id
    WHERE u.is_public = true
  `;

  res.json({ active, todayOutages, cityUsers, totals: totals[0] });
};