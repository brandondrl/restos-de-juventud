const { getSql } = require('./_db');
const { forbidden } = require('./_http');

module.exports = async (req, res) => {
  if (req.headers['x-internal-secret'] !== process.env.ADMIN_SECRET) {
    return forbidden(res);
  }
  const sql = getSql();
  const rows = await sql`
    SELECT a.user_id, a.start_time, u.telegram_chat_id
    FROM active_outage_v2 a
    JOIN users u ON u.id = a.user_id
    WHERE u.telegram_chat_id IS NOT NULL
  `;
  res.json(rows);
};