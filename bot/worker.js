const API = 'https://restos-de-juventud.vercel.app';
const TZ_OFFSET_HOURS = -4;

const MOOD_PROMPT = `¿Cómo te quedaste con este corte?

1️⃣ 😡 Arrecho
2️⃣ 😢 Triste
3️⃣ 😤 Frustrado
4️⃣ 😐 Normal
5️⃣ 😊 Feliz

_Responde con un número del 1 al 5. Sin esto no se cierra el registro._`;

const MOOD_MAP = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
const MOOD_LABELS = { 1: '😡 Arrecho', 2: '😢 Triste', 3: '😤 Frustrado', 4: '😐 Normal', 5: '😊 Feliz' };

const STRINGS = {
  welcome: `⚡ *Restos de Juventud Bot*\n\n¿Sin luz otra vez? Este bot te ayuda a registrarlo sin abrir la app.\n\n*Si ya tienes cuenta:* envía tu usuario ahora.\n\n*Si no tienes cuenta:* regístrate primero en:\nhttps://restos-de-juventud.vercel.app\n\nEs gratis y tarda 30 segundos.`,
  linked: (u) => `✅ Cuenta *@${u}* vinculada. Ya puedes usar los comandos.`,
  noAccount: `❌ No encontré ese usuario. Verifica en la app web.`,
  notLinked: `🔗 Primero vincula tu cuenta enviando /start y luego tu usuario.`,
  outageStarted: (t) => `⚡ Corte registrado a las *${t}*\n\nCuando vuelva la luz usa /volvio`,
  outageAlreadyActive: (t) => `⚠️ Ya tienes un corte activo desde las *${t}*\n\nUsa /volvio cuando regrese la luz.`,
  askMood: MOOD_PROMPT,
  outageEnded: (d, mood) => `💡 Luz de vuelta. Duración: *${d}*\nEstado: ${MOOD_LABELS[mood]}`,
  moodInvalid: `Responde solo con un número del 1 al 5.`,
  noActiveOutage: `ℹ️ No hay corte activo registrado.\n\nUsa /corte si se fue la luz.`,
  statusOn: (t) => `⚡ Sin luz desde las *${t}*\n\nUsa /volvio cuando regrese.`,
  statusOff: `💡 Con luz`,
  fluctuationSaved: (t) => `🔌 Fluctuación registrada a las *${t}*`,
  error: `❌ Error. Intenta de nuevo.`,
  duplicate: `⏳ Ya registré esa acción. Espera un momento.`,
  disconnected: `🔌 Cuenta desvinculada.`,
};

function localTime(date = new Date()) {
  const local = new Date(date.getTime() + TZ_OFFSET_HOURS * 3600000);
  const h = String(local.getUTCHours()).padStart(2, '0');
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
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

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function tg(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function apiGet(path, token) {
  const r = await fetch(`${API}${path}`, { headers: { Cookie: `auth=${token}` } });
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

async function getSession(kv, chatId) {
  return kv.get(`session:${chatId}`);
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

async function handleUpdate(env, update) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const rawCmd = text.split(' ')[0].toLowerCase();
  const cmd = rawCmd.replace(`@${(env.BOT_USERNAME || '').toLowerCase()}`, '');

  if (cmd === '/start') {
    await tg(env.BOT_TOKEN, chatId, STRINGS.welcome);
    return;
  }

  if (cmd === '/desconectar') {
    await env.KV.delete(`session:${chatId}`);
    await env.KV.delete(`pending_mood:${chatId}`);
    await tg(env.BOT_TOKEN, chatId, STRINGS.disconnected);
    return;
  }

  const session = await getSession(env.KV, chatId);

  const pendingMood = await env.KV.get(`pending_mood:${chatId}`);
  if (pendingMood && !cmd.startsWith('/')) {
    const moodValue = MOOD_MAP[text];
    if (!moodValue) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.moodInvalid);
      return;
    }
    const { outageId, outageStart } = JSON.parse(pendingMood);
    const endTime = new Date();
    const startTime = new Date(outageStart);
    const mins = (endTime - startTime) / 60000;
    const outage = {
      id: outageId,
      start: outageStart,
      end: endTime.toISOString(),
      duration_minutes: mins,
      type: 'corte',
      mood: moodValue,
    };
    const saved = await apiPost('/api/outages', outage, session);
    if (!saved) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await apiDelete('/api/active', session);
    await env.KV.delete(`pending_mood:${chatId}`);
    await tg(env.BOT_TOKEN, chatId, STRINGS.outageEnded(fmtDuration(mins), moodValue));
    return;
  }

  if (!session && !cmd.startsWith('/')) {
    const linked = await handleLogin(env, chatId, text);
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

  if (cmd === '/corte') {
    if (await isDuplicate(env.KV, chatId, 'start')) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet('/api/active', session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.outageAlreadyActive(localTime(new Date(active.start))));
      return;
    }
    const now = new Date();
    const outage = { id: generateId(), start: now.toISOString() };
    const ok = await apiPost('/api/active', outage, session);
    if (!ok) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await tg(env.BOT_TOKEN, chatId, STRINGS.outageStarted(localTime(now)));
    return;
  }

  if (cmd === '/volvio') {
    if (await isDuplicate(env.KV, chatId, 'end')) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet('/api/active', session);
    if (!active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.noActiveOutage);
      return;
    }
    await env.KV.put(
      `pending_mood:${chatId}`,
      JSON.stringify({ outageId: active.id, outageStart: active.start }),
      { expirationTtl: 300 }
    );
    await tg(env.BOT_TOKEN, chatId, STRINGS.askMood);
    return;
  }

  if (cmd === '/estado') {
    const active = await apiGet('/api/active', session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.statusOn(localTime(new Date(active.start))));
    } else {
      await tg(env.BOT_TOKEN, chatId, STRINGS.statusOff);
    }
    return;
  }

  if (cmd === '/fluctuacion') {
    if (await isDuplicate(env.KV, chatId, 'fluc')) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet('/api/active', session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, `⚠️ No puedes registrar una fluctuación con un corte activo.`);
      return;
    }
    const now = new Date();
    const fluc = { id: generateId(), start: now.toISOString(), end: now.toISOString(), duration_minutes: 0, type: 'fluctuacion' };
    const ok = await apiPost('/api/outages', fluc, session);
    if (!ok) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await tg(env.BOT_TOKEN, chatId, STRINGS.fluctuationSaved(localTime(now)));
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
    const flucs = outages.filter(o => o.type === 'fluctuacion' && new Date(o.start) >= cutoff);
    const total = period.reduce((s, o) => s + (o.duration_minutes || 0), 0);
    const label = cmd === '/semana' ? 'esta semana' : 'este mes';
    await tg(env.BOT_TOKEN, chatId, `📊 *Resumen ${label}*\n\n⚡ Cortes: *${period.length}*\n⏱ Total sin luz: *${fmtDuration(total)}*\n🔌 Fluctuaciones: *${flucs.length}*`);
    return;
  }

  if (cmd === '/probabilidad') {
    const active = await apiGet('/api/active', session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, `😮‍💨 Ya se fue la luz. Respira, lo más probable es que no se vaya de nuevo hoy.\n\nUsa /volvio cuando regrese.`);
      return;
    }
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
      const conf = Math.min(obs / 4, 1);
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
      a === b ? `${String(a).padStart(2, '0')}:00` : `${String(a).padStart(2, '0')}:00–${String(b + 1).padStart(2, '0')}:00`
    ).join(', ');
    await tg(env.BOT_TOKEN, chatId, `🔮 *Predicción para hoy*\n\n⏰ Riesgo: *${rangeText}*\n📈 Pico: *${String(peak.h).padStart(2, '0')}:00* (${Math.round(peak.prob * 100)}%)\n\n_Basado en tu historial personal._`);
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