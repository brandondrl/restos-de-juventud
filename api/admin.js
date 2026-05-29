const { getSql, initDb } = require('./_db');
const { requireAuth } = require('./_auth');

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.username !== 'brandon') return res.status(403).end();

  const sql = getSql();
  await initDb(sql);

  const rows = await sql`
    SELECT 
      u.id,
      u.username,
      u.city,
      u.zone,
      u.created_at,
      u.telegram_chat_id,
      COUNT(o.id)::int AS outage_count,
      MAX(o.start_time) AS last_activity
    FROM users u
    LEFT JOIN outages o ON o.user_id = u.id
    GROUP BY u.id, u.username, u.city, u.zone, u.created_at, u.telegram_chat_id
    ORDER BY outage_count DESC, u.created_at DESC
  `;

  return res.json(rows);
};