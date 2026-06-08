const { getSql } = require('./_db');

module.exports = async (req, res) => {
  if (req.headers['x-internal-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(403).end();
  }
  const sql = getSql();
  const rows = await sql`
    SELECT id, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL
  `;
  res.json(rows);
};