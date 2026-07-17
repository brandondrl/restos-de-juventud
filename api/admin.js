const { getSql, initDb } = require('./_db');
const { requireAuth } = require('./_auth');

function fmtDuration(mins) {
  if (!mins || mins <= 0) return '—';
  const total = Math.round(mins);
  const h = Math.floor(total / 60), m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

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
      COUNT(o.id) FILTER (WHERE o.type = 'corte' OR o.type IS NULL)::int AS outage_count,
      COUNT(o.id) FILTER (WHERE o.type = 'fluctuacion')::int AS fluc_count,
      COALESCE(SUM(o.duration_minutes) FILTER (WHERE o.type = 'corte' AND o.end_time IS NOT NULL), 0)::int AS total_mins,
      MAX(o.start_time) AS last_activity
    FROM users u
    LEFT JOIN outages o ON o.user_id = u.id
    GROUP BY u.id, u.username, u.city, u.zone, u.created_at, u.telegram_chat_id
    ORDER BY outage_count DESC, u.created_at DESC
  `;

  const totalUsers   = rows.length;
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
      ? `<span class="badge-bot">✈ Bot</span>`
      : `<span class="badge-nobot">Sin bot</span>`;
    const city = [r.city?.trim(), r.zone?.trim()].filter(Boolean).join(' · ') || '—';
    const avg = r.outage_count > 0 ? fmtDuration(r.total_mins / r.outage_count) : '—';
    return `<tr>
      <td class="col-user">@${r.username}</td>
      <td class="col-city">${city}</td>
      <td class="col-num">${r.outage_count}</td>
      <td class="col-num col-accent">${fmtDuration(r.total_mins)}</td>
      <td class="col-num">${avg}</td>
      <td class="col-num col-fluc">${r.fluc_count}</td>
      <td class="col-date">${lastActivity}</td>
      <td class="col-date">${createdAt}</td>
      <td>${tgBadge}</td>
      <td>${r.username !== 'brandon' ? `<button class="btn-reset" data-userid="${r.id}" data-username="${r.username}">🔄 Reset pass</button>` : '<span class="na">—</span>'}</td>
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
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:24px}
@media(min-width:480px){.stats{grid-template-columns:repeat(4,1fr)}}
.stat{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px 14px}
.stat-val{font-size:24px;font-weight:700;color:#f59e0b;margin-bottom:2px}
.stat-lbl{font-size:11px;color:#64748b;font-weight:600;letter-spacing:.05em}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px;border:1px solid #334155;}
table{width:100%;border-collapse:collapse;min-width:680px}
thead tr{background:#0f172a;border-bottom:1px solid #334155}
thead th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em;white-space:nowrap}
thead th.col-num{text-align:center}
tbody tr{border-bottom:1px solid #1a2540}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,.03)}
.col-user{padding:10px 14px;font-weight:600;color:#f1f5f9;white-space:nowrap}
.col-city{padding:10px 14px;color:#94a3b8;font-size:13px}
.col-num{padding:10px 14px;text-align:center;font-weight:700;color:#f59e0b;font-size:15px}
.col-accent{color:#86efac !important}
.col-fluc{color:#fed7aa !important}
.col-date{padding:10px 14px;color:#94a3b8;font-size:12px;white-space:nowrap}
.badge-bot{background:#0f3460;border:1px solid #1a6bb5;color:#7dd3fc;padding:2px 8px;border-radius:4px;font-size:11px;white-space:nowrap}
.badge-nobot{background:#1e293b;border:1px solid #334155;color:#475569;padding:2px 8px;border-radius:4px;font-size:11px;white-space:nowrap}
.back{display:inline-flex;align-items:center;gap:6px;color:#64748b;font-size:13px;text-decoration:none;margin-bottom:20px}
.back:hover{color:#94a3b8}
.btn-reset{background:transparent;border:1px solid #64748b;color:#94a3b8;padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;white-space:nowrap}
.btn-reset:hover{border-color:#f59e0b;color:#f59e0b}
.btn-reset:disabled{opacity:.4;cursor:default}
.na{color:#334155;font-size:11px}
.dialog-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:999}
.dialog-card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;max-width:480px;width:90%}
.dialog-card .dtitle{font-size:15px;font-weight:700;margin-bottom:8px}
.dialog-card .dbody{font-size:13px;color:#94a3b8;margin-bottom:16px;line-height:1.5;word-break:break-all}
.dialog-card .dinput{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;font-family:monospace;margin-bottom:16px}
.dialog-card .dinput:focus{outline:none;border-color:#f59e0b}
.dbtn{background:#1e293b;border:1px solid #334155;color:#f1f5f9;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer}
.dbtn:hover{border-color:#64748b}
.dbtn-primary{background:#f59e0b;border-color:#f59e0b;color:#0f172a;font-weight:600}
.dbtn-primary:hover{background:#d97706;border-color:#d97706}
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
        <th class="col-num">CORTES</th>
        <th class="col-num">TIEMPO TOTAL</th>
        <th class="col-num">PROM/CORTE</th>
        <th class="col-num">FLUCT.</th>
        <th>ÚLTIMA ACT.</th>
        <th>REGISTRO</th>
        <th>TELEGRAM</th>
        <th>ACCIÓN</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>
<script>
(function(){
  document.querySelectorAll('.btn-reset').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var uid = this.dataset.userid;
      var uname = this.dataset.username;
      if (!confirm('¿Estás seguro de resetear la contraseña para @' + uname + '?')) return;
      this.disabled = true;
      this.textContent = '...';
      try {
        var r = await fetch('/api/auth/admin-reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid }),
        });
        var data = await r.json();
        if (!r.ok) { alert('Error: ' + (data.error || 'desconocido')); this.disabled = false; this.textContent = '🔄 Reset pass'; return; }
        var msg = data.sentViaTelegram
          ? '✅ El enlace de reseteo fue enviado a @' + data.username + ' por Telegram.\\n\\nTambién puedes copiar el enlace manualmente:'
          : '⚠️ @' + data.username + ' no tiene Telegram vinculado.\\n\\nCopia este enlace y envíalo manualmente (válido 15 min):';
        msg += '\\n\\n' + data.resetUrl;
        prompt(msg, data.resetUrl);
      } catch(e) {
        alert('Error de red: ' + e.message);
      }
      this.disabled = false;
      this.textContent = '🔄 Reset pass';
    });
  });
})();
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
};