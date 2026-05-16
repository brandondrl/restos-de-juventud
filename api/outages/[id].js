const { getSql } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const sql = getSql();
  await sql`DELETE FROM outages WHERE id = ${req.query.id}`;
  res.json({ ok: true });
};
