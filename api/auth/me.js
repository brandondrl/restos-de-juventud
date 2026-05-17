const { requireAuth } = require('../_auth');
const { getSql } = require('../_db');

module.exports = async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const sql = getSql();
  const rows = await sql`SELECT id, username, city, zone, is_public FROM users WHERE id = ${auth.id}`;
  if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
};
