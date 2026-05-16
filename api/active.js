const { getSql, initDb } = require('./_db');

module.exports = async (req, res) => {
  const sql = getSql();
  await initDb(sql);

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM active_outage WHERE singleton = 'current'`;
    if (!rows.length) return res.json(null);
    const r = rows[0];
    return res.json({ id: r.outage_id, start: r.start_time });
  }

  if (req.method === 'POST') {
    const { id, start } = req.body;
    await sql`
      INSERT INTO active_outage (singleton, outage_id, start_time)
      VALUES ('current', ${id}, ${start})
      ON CONFLICT (singleton) DO UPDATE SET outage_id=EXCLUDED.outage_id, start_time=EXCLUDED.start_time
    `;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM active_outage WHERE singleton = 'current'`;
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
