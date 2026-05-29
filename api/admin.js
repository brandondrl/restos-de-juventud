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

  const totalUsers = rows.length;
  const totalOutages = rows.reduce((s, r) => s + r.outage_count, 0);
  const withTelegram = rows.filter(r => r.telegram_chat_id).length;
  const activeThisWeek = rows.filter(r => {
    if (!r.last_activity) return false;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    return new Date(r.last_activity) >= cutoff;
  }).length;

  const rowsHtml = rows.map(r => {
    const lastActivity = r.last_activity
      ? new Date(r.last_activity).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';
    const createdAt = new Date(r.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const tgBadge = r.telegram_chat_id
      ? `<span style="background:#0f3460;border:1px solid #1a6bb5;color:#7dd3fc;padding:2px 8px;border-radius:4px;font-size:11px">✈ Bot</span>`
      : `<span style="background:#1e293b;border:1px solid #334155;color:#475569;padding:2px 8px;border-radius:4px;font-size:11px">Sin bot</span>`;
    const city = [r.city?.trim(), r.zone?.trim()].filter(Boolean).join(' · ') || '—';
    return `<tr>
      <td style="padding:10px 14px;font-weight:600;color:#f1f5f9">@${r.username}</td>
      <td style="padding:10px 14px;color:#94a3b8;font-size:13px">${city}</td>
      <td style="padding:10px 14px;text-align:center;font-weight:700;color:#f59e0b;font-size:16px">${r.outage_count}</td>
      <td style="padding:10px 14px;color:#94a3b8;font-size:12px">${lastActivity}</td>
      <td style="padding:10px 14px;color:#64748b;font-size:11px">${createdAt}</td>
      <td style="padding:10px 14px">${tgBadge}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin · Restos de Juventud</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh;padding:24px 16px}
.header{display:flex;align-items:center;gap:10px;margin-bottom:24px}
.header svg{stroke:#f59e0b;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.title{font-size:18px;font-weight:700}
.subtitle{font-size:12px;color:#64748b;margin-top:2px}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:24px;max-width:720px}
@media(min-width:480px){.stats{grid-template-columns:repeat(4,1fr)}}
.stat{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px 14px}
.stat-val{font-size:24px;font-weight:700;color:#f59e0b;margin-bottom:2px}
.stat-lbl{font-size:11px;color:#64748b;font-weight:600;letter-spacing:.05em}
.table-wrap{background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden;max-width:900px}
table{width:100%;border-collapse:collapse}
thead tr{background:#0f172a;border-bottom:1px solid #334155}
thead th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em}
thead th:nth-child(3){text-align:center}
tbody tr{border-bottom:1px solid #1e293b}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,.03)}
.back{display:inline-flex;align-items:center;gap:6px;color:#64748b;font-size:13px;text-decoration:none;margin-bottom:20px}
.back:hover{color:#94a3b8}
</style>
</head>
<body>
<a class="back" href="/">← Volver a la app</a>
<div class="header">
  <svg viewBox="0 0 24 24" width="22" height="22"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  <div>
    <div class="title">Panel de administración</div>
    <div class="subtitle">Restos de Juventud · Solo visible para ti</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${totalUsers}</div><div class="stat-lbl">USUARIOS</div></div>
  <div class="stat"><div class="stat-val">${totalOutages}</div><div class="stat-lbl">CORTES TOTALES</div></div>
  <div class="stat"><div class="stat-val">${activeThisWeek}</div><div class="stat-lbl">ACTIVOS 7 DÍAS</div></div>
  <div class="stat"><div class="stat-val">${withTelegram}</div><div class="stat-lbl">CON BOT</div></div>
</div>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>USUARIO</th>
        <th>CIUDAD</th>
        <th>CORTES</th>
        <th>ÚLTIMA ACTIVIDAD</th>
        <th>REGISTRO</th>
        <th>TELEGRAM</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
};