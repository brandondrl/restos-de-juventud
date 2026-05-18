const { getSql } = require('./_db');
const { getUser } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const sql = getSql();
  getUser(req); // optional auth context, not required

  const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // Users currently without power (public only)
  const active = await sql`
    SELECT u.username, u.city, u.zone, a.start_time
    FROM active_outage a
    JOIN users u ON u.id = a.user_id
    WHERE u.is_public = true
    ORDER BY a.start_time ASC
  `;

  // Today's totals by city
  const todayByCity = await sql`
    SELECT
      u.city,
      COUNT(*)::int AS cortes,
      COALESCE(SUM(o.duration_minutes), 0)::int AS total_mins
    FROM outages o
    JOIN users u ON u.id = o.user_id
    WHERE u.is_public = true
      AND o.type = 'corte'
      AND o.start_time >= ${todayISO}
      AND o.end_time IS NOT NULL
    GROUP BY u.city
    ORDER BY total_mins DESC
  `;

  // User count per city
  const cityUsers = await sql`
    SELECT city, COUNT(*)::int AS total
    FROM users
    WHERE is_public = true AND city != ''
    GROUP BY city
    ORDER BY total DESC
  `;

  // Global totals
  const totals = await sql`
    SELECT
      COUNT(DISTINCT u.id)::int AS total_users,
      COUNT(DISTINCT a.user_id)::int AS active_now
    FROM users u
    LEFT JOIN active_outage a ON a.user_id = u.id AND u.is_public = true
    WHERE u.is_public = true
  `;

  res.json({ active, todayByCity, cityUsers, totals: totals[0] });
};
