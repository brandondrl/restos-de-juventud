const { getSql } = require('./_db');
const { requireAuth } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res);
  if (!user) return;
  const sql = getSql();

  const rows = await sql`
    SELECT start_time, end_time, duration_minutes, type, notes
    FROM outages
    WHERE user_id = ${user.id} AND end_time IS NOT NULL
    ORDER BY start_time DESC
  `;

  const header = 'Inicio,Fin,Duración (min),Tipo,Notas';
  const lines = rows.map(r =>
    `"${r.start_time}","${r.end_time || ''}","${Math.round(r.duration_minutes || 0)}","${r.type || 'corte'}","${(r.notes || '').replace(/"/g, '""')}"`
  );

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="restos-de-juventud-${date}.csv"`);
  res.send([header, ...lines].join('\n'));
};
