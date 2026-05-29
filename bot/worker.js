const API = 'http://restos-de-juventud.vercel.app';

const STRINGS = {
  welcome: `⚡ *Restos de Juventud Bot*\n\nEnvía tu usuario de la app para vincular tu cuenta.\n\nEjemplo: \`tuusuario\``,
  linked: (u) => `✅ Cuenta *@${u}* vinculada. Ya puedes usar los comandos.`,
  noAccount: `❌ No encontré ese usuario. Verifica en la app.`,
  notLinked: `🔗 Primero vincula tu cuenta enviando /start`,
  outageStarted: (t) => `⚡ Corte registrado a las *${t}*`,
  outageAlreadyActive: (t) => `⚠️ Ya tienes un corte activo desde las *${t}*`,
  outageEnded: (d) => `💡 Luz de vuelta. Duración: *${d}*`,
  noActiveOutage: `ℹ️ No hay corte activo registrado.`,
  status_on: (t) => `⚡ Sin luz desde las *${t}*`,
  status_off: `💡 Con luz`,
  error: `❌ Error. Intenta de nuevo.`,
  duplicate: `⏳ Ya registré esa acción. Espera un momento.`,
};

function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDuration(mins) {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

function dedupeKey(chatId, cmd) {
  const bucket = Math.floor(Date.now() / 90000);
  return `dedup:${chatId}:${cmd}:${bucket}`;
}

async function isDuplicate(kv, chatId, cmd) {
  const key = dedupeKey(chatId, cmd);
  const val = await kv.get(key);
  if (val) return true;
  await kv.put(key, '1', { expirationTtl: 90 });
  return false;
}

async function apiGet(path, token) {
  const r = await fetch(`${API}${path}`, {
    headers: { Cookie: `auth=${token}` }
  });
  if (!r.ok) return null;
  return r.json();
}

async function apiPost(path, body, token) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `auth=${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  return r.json();
}

async function apiDelete(path, token) {
  const r = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { Cookie: `auth=${token}` },
  });
  return r.ok;
}

async function tg(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function handleLogin(env, chatId, username) {
  const r = await fetch(`${API}/api/auth/telegram-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: username, chat_id: chatId }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.ok) return null;
  await env.KV.put(`session:${chatId}`, data.token, { expirationTtl: 2592000 });
  return data.username;
}

async function getSession(kv, chatId) {
  return kv.get(`session:${chatId}`);
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function handleUpdate(env, update) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const cmd = text.split(' ')[0].toLowerCase().replace('@' + env.BOT_USERNAME, '');

  if (cmd === '/start') {
    await tg(env.BOT_TOKEN, chatId, STRINGS.welcome);
    return;
  }

  if (cmd === '/desconectar') {
    await env.KV.delete(`session:${chatId}`);
    await tg(env.BOT_TOKEN, chatId, '🔌 Cuenta desvinculada.');
    return;
  }

  const session = await getSession(env.KV, chatId);

  if (!session && !cmd.startsWith('/')) {
    const linked = await handleLogin(env, chatId, text.trim());
    if (linked) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.linked(linked));
    } else {
      await tg(env.BOT_TOKEN, chatId, STRINGS.noAccount);
    }
    return;
  }

  if (!session) {
    await tg(env.BOT_TOKEN, chatId, STRINGS.notLinked);
    return;
  }

  if (cmd === '/luz_se_fue') {
    if (await isDuplicate(env.KV, chatId, 'start')) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet('/api/active', session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.outageAlreadyActive(fmtTime(active.start)));
      return;
    }
    const now = new Date().toISOString();
    const outage = { id: generateId(), start: now };
    const ok = await apiPost('/api/active', outage, session);
    if (!ok) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await tg(env.BOT_TOKEN, chatId, STRINGS.outageStarted(fmtTime(now)));
    return;
  }

  if (cmd === '/volvio_la_luz') {
    if (await isDuplicate(env.KV, chatId, 'end')) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet('/api/active', session);
    if (!active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.noActiveOutage);
      return;
    }
    const endTime = new Date();
    const startTime = new Date(active.start);
    const mins = (endTime - startTime) / 60000;
    const outage = {
      id: active.id,
      start: active.start,
      end: endTime.toISOString(),
      duration_minutes: mins,
      type: 'corte',
      mood: null,
    };
    const saved = await apiPost('/api/outages', outage, session);
    if (!saved) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await apiDelete('/api/active', session);
    await tg(env.BOT_TOKEN, chatId, STRINGS.outageEnded(fmtDuration(mins)));
    return;
  }

  if (cmd === '/estado') {
    const active = await apiGet('/api/active', session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.status_on(fmtTime(active.start)));
    } else {
      await tg(env.BOT_TOKEN, chatId, STRINGS.status_off);
    }
    return;
  }

  if (cmd === '/semana' || cmd === '/mes') {
    const outages = await apiGet('/api/outages', session);
    if (!outages) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    const now = new Date();
    const cutoff = new Date(now);
    if (cmd === '/semana') {
      cutoff.setDate(now.getDate() - now.getDay());
      cutoff.setHours(0, 0, 0, 0);
    } else {
      cutoff.setDate(1);
      cutoff.setHours(0, 0, 0, 0);
    }
    const period = outages.filter(o => o.end && o.type !== 'fluctuacion' && new Date(o.start) >= cutoff);
    const flucs  = outages.filter(o => o.type === 'fluctuacion' && new Date(o.start) >= cutoff);
    const total  = period.reduce((s, o) => s + (o.duration_minutes || 0), 0);
    const label  = cmd === '/semana' ? 'esta semana' : 'este mes';
    const reply  = `📊 *Resumen ${label}*\n\n⚡ Cortes: *${period.length}*\n⏱ Total sin luz: *${fmtDuration(total)}*\n🔌 Fluctuaciones: *${flucs.length}*`;
    await tg(env.BOT_TOKEN, chatId, reply);
    return;
  }

  if (cmd === '/probabilidad') {
    const outages = await apiGet('/api/outages', session);
    if (!outages || outages.length < 3) {
      await tg(env.BOT_TOKEN, chatId, 'ℹ️ Necesitas más registros para calcular probabilidades.');
      return;
    }
    const now = new Date();
    const day = now.getDay();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 84);
    const completed = outages.filter(o => o.start && o.end && o.type !== 'fluctuacion' && new Date(o.start) >= windowStart);
    const slots = {};
    const observations = {};
    const cur = new Date(windowStart);
    cur.setHours(0, 0, 0, 0);
    while (cur <= now) {
      for (let h = 0; h < 24; h++) {
        const k = `${cur.getDay()}_${h}`;
        observations[k] = (observations[k] || 0) + 1;
      }
      cur.setDate(cur.getDate() + 1);
    }
    completed.forEach(o => {
      const s = new Date(o.start), e = new Date(o.end), c = new Date(s);
      c.setMinutes(0, 0, 0);
      while (c < e) {
        const k = `${c.getDay()}_${c.getHours()}`;
        slots[k] = (slots[k] || 0) + 1;
        c.setHours(c.getHours() + 1);
      }
    });
    const risky = [];
    for (let h = 5; h <= 23; h++) {
      const k = `${day}_${h}`;
      const obs = observations[k] || 1;
      const hits = slots[k] || 0;
      const weeks = obs / 4;
      const conf = Math.min(weeks, 1);
      const prob = ((hits + 0.5) / (obs + 1)) * conf;
      if (prob >= 0.18) risky.push({ h, prob });
    }
    if (!risky.length) {
      await tg(env.BOT_TOKEN, chatId, '✅ Sin riesgo significativo hoy según tu historial.');
      return;
    }
    const peak = risky.reduce((a, b) => b.prob > a.prob ? b : a);
    const ranges = [];
    let rs = null, re = null;
    risky.forEach(({ h }) => {
      if (rs === null) { rs = h; re = h; }
      else if (h === re + 1) { re = h; }
      else { ranges.push([rs, re]); rs = h; re = h; }
    });
    if (rs !== null) ranges.push([rs, re]);
    const rangeText = ranges.map(([a, b]) =>
      a === b ? `${String(a).padStart(2,'0')}:00` : `${String(a).padStart(2,'0')}:00–${String(b+1).padStart(2,'0')}:00`
    ).join(', ');
    const reply = `🔮 *Predicción para hoy*\n\n⏰ Horas de riesgo: *${rangeText}*\n📈 Pico: *${String(peak.h).padStart(2,'0')}:00* (${Math.round(peak.prob*100)}%)\n\n_Basado en tu historial personal._`;
    await tg(env.BOT_TOKEN, chatId, reply);
    return;
  }

  await tg(env.BOT_TOKEN, chatId, `Comando no reconocido. Usa /start para comenzar.`);
}

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('ok');
    const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
    const update = await req.json();
    await handleUpdate(env, update);
    return new Response('ok');
  }
};