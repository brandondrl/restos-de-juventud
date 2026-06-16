const { getSql } = require('./_db');
const { forbidden } = require('./_http');
const config = require('./_config');

module.exports = async (req, res) => {
  if (!config.ADMIN_SECRET) {
    console.error('[Config] ADMIN_SECRET no configurado');
    return res.status(500).json({ error: 'Error de configuración del servidor. Contacta con el administrador.' });
  }

  if (req.headers['x-internal-secret'] !== config.ADMIN_SECRET) {
    return forbidden(res);
  }

  const sql = getSql();
  const rows = await sql`
    SELECT a.user_id, a.outage_id, a.start_time, u.telegram_chat_id
    FROM active_outage_v2 a
    JOIN users u ON u.id = a.user_id
    WHERE u.telegram_chat_id IS NOT NULL
  `;
  res.json(rows);
};
