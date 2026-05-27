const { getSql, initDb } = require('./_db');

module.exports = async (req, res) => {

  if (req.query.secret !== process.env.ADMIN_SECRET) {
    return res.status(404).end();
  }

  const sql = getSql();
  await initDb(sql);

  const rows = await sql`
    SELECT 
      u.id,
      u.username,
      u.city,
      u.zone,
      u.created_at,
      COUNT(o.id) AS outage_count,
      MAX(o.start_time) AS last_activity
    FROM users u
    LEFT JOIN outages o ON o.user_id = u.id
    GROUP BY u.id, u.username, u.city, u.zone, u.created_at
    ORDER BY outage_count DESC, u.created_at DESC
  `;

  return res.json(rows);
};