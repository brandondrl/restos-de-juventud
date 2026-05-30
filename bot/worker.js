const API = 'https://restos-de-juventud.vercel.app';
const TZ_OFFSET_HOURS = -4;
const WEEKS_FOR_FULL_CONFIDENCE = 4;

const MOOD_PROMPT = `¿Cómo te quedaste con este corte?

1️⃣ 😡 Arrecho
2️⃣ 😢 Triste
3️⃣ 😤 Frustrado
4️⃣ 😐 Normal
5️⃣ 😊 Feliz

_Responde con un número del 1 al 5. Sin esto no se cierra el registro._`;

const MOOD_MAP = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
const MOOD_LABELS = { 1: '😡 Arrecho', 2: '😢 Triste', 3: '😤 Frustrado', 4: '😐 Normal', 5: '😊 Feliz' };

const REMINDERS = [
  { minutes: 120, msg: (d) => `⚡ Llevas *${d}* sin luz. El bot está pendiente contigo.` },
  { minutes: 240, msg: (d) => `🕯️ *${d}* sin luz. Ya esto es una odisea. Ánimo.` },
  { minutes: 300, msg: (d) => `😤 *${d}* sin luz... ¿y el operador? Respira, ya debe faltar poco (o eso queremos creer).` },
  { minutes: 360, msg: (d) => `💀 *${d}* SIN LUZ. Vergación nada que vuelve. A este punto ya el ventilador es un recuerdo. Aguanta.` },
];

const STRINGS = {
  welcome: `⚡ *Restos de Juventud Bot*\n\n¿Sin luz otra vez? Este bot te ayuda a registrarlo sin abrir la app.\n\n*Si ya tienes cuenta:* envía tu usuario ahora.\n\n*Si no tienes cuenta:* regístrate primero en:\nhttps://restos-de-juventud.vercel.app\n\nEs gratis y tarda 30 segundos.`,
  linked: (u) => `✅ Cuenta *@${u}* vinculada. Ya puedes usar los comandos.\n\nManda /ayuda si no sabes por dónde empezar.`,
  noAccount: `❌ No encontré ese usuario. Verifica en la app web.`,
  notLinked: `🔗 Primero vincula tu cuenta enviando /start y luego tu usuario.`,
  outageStarted: (t, summary) => `⚡ Corte registrado a las *${t}*\n${summary}\nUsa /volvio cuando regrese la luz.`,
  outageAlreadyActive: (t) => `⚠️ Ya tienes un corte activo desde las *${t}*\n\nUsa /volvio cuando regrese la luz.`,
  askMood: MOOD_PROMPT,
  outageEnded: (d, mood, summary) => `💡 Luz de vuelta. Duración: *${d}*\nEstado: ${MOOD_LABELS[mood]}\n\n${summary}`,
  moodInvalid: `Responde solo con un número del 1 al 5.`,
  noActiveOutage: `ℹ️ No hay corte activo registrado.\n\nUsa /corte si se fue la luz.`,
  statusOn: (t, elapsed) => `⚡ Sin luz desde las *${t}* — llevas *${elapsed}*\n\nUsa /volvio cuando regrese.`,
  statusOff: `💡 Con luz`,
  fluctuationSaved: (t) => `🔌 Fluctuación registrada a las *${t}*`,
  fluctuationDuringOutage: `⚠️ No puedes registrar una fluctuación con un corte activo.`,
  error: `❌ Error. Intenta de nuevo.`,
  duplicate: `⏳ Ya registré esa acción. Espera un momento.`,
  disconnected: (summary) => `🔌 Cuenta desvinculada.\n\n${summary}\n\nHasta la próxima apagón 👋`,
  groupOnly: `Para vincular tu cuenta háblame en privado 👉`,
  unknown: `Comando no reconocido.\n\nUsa /ayuda para ver los comandos disponibles.`,
  help: `⚡ *Comandos disponibles*\n\n/corte — Se fue la luz\n/volvio — Volvió la luz\n/fluctuacion — Bajón o pico rápido\n/estado — Ver estado actual\n/hoy — Resumen del día\n/semana — Resumen de esta semana\n/mes — Resumen de este mes\n/probabilidad — Riesgo de corte hoy\n/ayuda — Esta lista\n/desconectar — Desvincular cuenta`,
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

function dedupeKey(userId, cmd) {
  const bucket = Math.floor(Date.now() / 90000);
  return `dedup:${userId}:${cmd}:${bucket}`;
}

async function isDuplicate(kv, userId, cmd) {
  const key = dedupeKey(userId, cmd);
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

async function tgButtons(botToken, chatId, text, buttons) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    }),
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

async function getSession(kv, userId) {
  return kv.get(`session:${userId}`);
}

async function handleLogin(env, userId, username) {
  const r = await fetch(`${API}/api/auth/telegram-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: username, chat_id: userId }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.ok) return null;
  await env.KV.put(`session:${userId}`, data.token, { expirationTtl: 2592000 });
  return data.username;
}

function buildDaySummary(outages) {
  const now = new Date();
  const localNow = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600000);
  const startOfToday = new Date(localNow);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTodayUTC = new Date(startOfToday.getTime() - TZ_OFFSET_HOURS * 3600000);

  const todayCortes = outages.filter(o =>
    o.end && (o.type || 'corte') === 'corte' && new Date(o.start) >= startOfTodayUTC
  );
  const todayFlucs = outages.filter(o =>
    (o.type || 'corte') === 'fluctuacion' && new Date(o.start) >= startOfTodayUTC
  );
  const totalMins = todayCortes.reduce((s, o) => s + (o.duration_minutes || 0), 0);
  if (!todayCortes.length && !todayFlucs.length) return `📋 Hoy: sin cortes registrados aún.`;
  const parts = [];
  if (todayCortes.length) parts.push(`${todayCortes.length} corte${todayCortes.length !== 1 ? 's' : ''} · ${fmtDuration(totalMins)}`);
  if (todayFlucs.length) parts.push(`${todayFlucs.length} fluctuación${todayFlucs.length !== 1 ? 'es' : ''}`);
  return `📋 Hoy: ${parts.join(' · ')}`;
}

async function handleUpdate(env, update) {
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;
    const chatId = cb.message.chat.id;
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id }),
    });
    await handleUpdate(env, {
      message: {
        from: { id: userId },
        chat: { id: chatId, type: 'private' },
        text: cb.data,
      },
    });
    return;
  }

  const msg = update.message;
  if (!msg || !msg.text) return;

  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const text = msg.text.trim();
  const rawCmd = text.split(' ')[0].toLowerCase();
  const cmd = rawCmd.replace(`@${(env.BOT_USERNAME || '').toLowerCase()}`, '');

  if (cmd === '/start') {
    if (isGroup) {
      await tg(env.BOT_TOKEN, chatId, `${STRINGS.groupOnly} @${env.BOT_USERNAME}`);
      return;
    }
    await tgButtons(env.BOT_TOKEN, chatId, STRINGS.welcome, [
      [{ text: '🌐 Ir a la app web', url: 'https://restos-de-juventud.vercel.app' }],
    ]);
    return;
  }

  if (cmd === '/ayuda') {
    await tg(env.BOT_TOKEN, chatId, STRINGS.help);
    return;
  }

  if (cmd === '/desconectar') {
    const session = await getSession(env.KV, userId);
    let summary = '';
    if (session) {
      const outages = await apiGet('/api/outages', session);
      if (outages) {
        const total = outages.filter(o => o.end && (o.type || 'corte') === 'corte');
        const mins = total.reduce((s, o) => s + (o.duration_minutes || 0), 0);
        summary = `Registraste *${total.length}* cortes · *${fmtDuration(mins)}* sin luz en total.`;
      }
    }
    await env.KV.delete(`session:${userId}`);
    await env.KV.delete(`pending_mood:${userId}`);
    await tg(env.BOT_TOKEN, chatId, STRINGS.disconnected(summary));
    return;
  }

  const session = await getSession(env.KV, userId);

  const pendingMoodRaw = await env.KV.get(`pending_mood:${userId}`);
  if (pendingMoodRaw && !cmd.startsWith('/')) {
    const moodValue = MOOD_MAP[text];
    if (!moodValue) { await tg(env.BOT_TOKEN, chatId, STRINGS.moodInvalid); return; }
    let pending;
    try { pending = JSON.parse(pendingMoodRaw); } catch { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    const endTime = new Date();
    const startTime = new Date(pending.outageStart);
    const mins = (endTime - startTime) / 60000;
    const outage = { id: pending.outageId, start: pending.outageStart, end: endTime.toISOString(), duration_minutes: mins, type: 'corte', mood: moodValue };
    const saved = await apiPost('/api/outages', outage, session);
    if (!saved) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await apiDelete('/api/active', session);
    await env.KV.delete(`pending_mood:${userId}`);
    await env.KV.delete(`reminded:${userId}`);
    const outages = await apiGet('/api/outages', session);
    const summary = outages ? buildDaySummary(outages) : '';
    await tg(env.BOT_TOKEN, chatId, STRINGS.outageEnded(fmtDuration(mins), moodValue, summary));
    return;
  }

  if (!session && !cmd.startsWith('/')) {
    if (isGroup) return;
    const linked = await handleLogin(env, userId, text);
    if (linked) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.linked(linked));
    } else {
      await tg(env.BOT_TOKEN, chatId, STRINGS.noAccount);
    }
    return;
  }

  if (!session) { await tg(env.BOT_TOKEN, chatId, STRINGS.notLinked); return; }

  if (cmd === '/corte') {
    if (await isDuplicate(env.KV, userId, 'start')) { await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate); return; }
    const active = await apiGet('/api/active', session);
    if (active) { await tg(env.BOT_TOKEN, chatId, STRINGS.outageAlreadyActive(localTime(new Date(active.start)))); return; }
    const now = new Date();
    const outage = { id: generateId(), start: now.toISOString() };
    const ok = await apiPost('/api/active', outage, session);
    if (!ok) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    const outages = await apiGet('/api/outages', session);
    const summary = outages ? buildDaySummary(outages) : '';
    await tgButtons(env.BOT_TOKEN, chatId, STRINGS.outageStarted(localTime(now), summary), [
      [{ text: '💡 Ya volvió la luz', callback_data: '/volvio' }],
    ]);
    return;
  }

  if (cmd === '/volvio') {
    if (await isDuplicate(env.KV, userId, 'end')) { await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate); return; }
    const active = await apiGet('/api/active', session);
    if (!active) { await tg(env.BOT_TOKEN, chatId, STRINGS.noActiveOutage); return; }
    await env.KV.put(
      `pending_mood:${userId}`,
      JSON.stringify({ outageId: active.id, outageStart: active.start }),
      { expirationTtl: 300 }
    );
    await tg(env.BOT_TOKEN, chatId, STRINGS.askMood);
    return;
  }

  if (cmd === '/estado') {
    const active = await apiGet('/api/active', session);
    if (!active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.statusOff);
      return;
    }
    const elapsed = (Date.now() - new Date(active.start).getTime()) / 60000;
    const outagesForEta = await apiGet('/api/outages', session);
    let etaLine = '';
    if (outagesForEta) {
      const completed = outagesForEta.filter(o => o.end && (o.type || 'corte') === 'corte' && o.duration_minutes > 0);
      if (completed.length >= 2) {
        const avg = completed.reduce((s, o) => s + o.duration_minutes, 0) / completed.length;
        const remaining = avg - elapsed;
        etaLine = remaining > 0
          ? `
⏳ Estimado restante: *${fmtDuration(remaining)}* (promedio: ${fmtDuration(avg)})`
          : `
⚠️ Superó el promedio histórico de *${fmtDuration(avg)}*`;
      }
    }
    await tgButtons(env.BOT_TOKEN, chatId,
      `⚡ Sin luz desde las *${localTime(new Date(active.start))}*
Llevas *${fmtDuration(elapsed)}* sin luz${etaLine}`,
      [[{ text: '💡 Ya volvió la luz', callback_data: '/volvio' }]]
    );
    return;
  }

  if (cmd === '/fluctuacion') {
    if (await isDuplicate(env.KV, userId, 'fluc')) { await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate); return; }
    const active = await apiGet('/api/active', session);
    if (active) { await tg(env.BOT_TOKEN, chatId, STRINGS.fluctuationDuringOutage); return; }
    const now = new Date();
    const fluc = { id: generateId(), start: now.toISOString(), end: now.toISOString(), duration_minutes: 0, type: 'fluctuacion' };
    const ok = await apiPost('/api/outages', fluc, session);
    if (!ok) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await tg(env.BOT_TOKEN, chatId, STRINGS.fluctuationSaved(localTime(now)));
    return;
  }

  if (cmd === '/hoy') {
    const outages = await apiGet('/api/outages', session);
    if (!outages) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    const now = new Date();
    const localNowHoy = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600000);
    const startOfTodayLocal = new Date(localNowHoy); startOfTodayLocal.setUTCHours(0, 0, 0, 0);
    const startOfToday = new Date(startOfTodayLocal.getTime() - TZ_OFFSET_HOURS * 3600000);
    const active = await apiGet('/api/active', session);
    const todayCortes = outages.filter(o => o.end && (o.type || 'corte') === 'corte' && new Date(o.start) >= startOfToday);
    const todayFlucs = outages.filter(o => (o.type || 'corte') === 'fluctuacion' && new Date(o.start) >= startOfToday);
    const totalMins = todayCortes.reduce((s, o) => s + (o.duration_minutes || 0), 0);
    let reply = `📅 *Hoy*\n\n`;
    if (active) reply += `⚡ Corte activo desde las ${localTime(new Date(active.start))}\n`;
    reply += `🔴 Cortes: *${todayCortes.length}* · ${fmtDuration(totalMins)}\n`;
    reply += `🔌 Fluctuaciones: *${todayFlucs.length}*`;
    if (!todayCortes.length && !todayFlucs.length && !active) reply += `\n\n✅ Sin incidencias hoy.`;
    await tg(env.BOT_TOKEN, chatId, reply);
    return;
  }

  if (cmd === '/semana' || cmd === '/mes') {
    const outages = await apiGet('/api/outages', session);
    if (!outages) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    const now = new Date();
    const cutoff = new Date(now);
    if (cmd === '/semana') { cutoff.setDate(now.getDate() - now.getDay()); cutoff.setHours(0, 0, 0, 0); }
    else { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0); }
    const period = outages.filter(o => o.end && (o.type || 'corte') === 'corte' && new Date(o.start) >= cutoff);
    const flucs = outages.filter(o => (o.type || 'corte') === 'fluctuacion' && new Date(o.start) >= cutoff);
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
    if (!outages || outages.length < 3) { await tg(env.BOT_TOKEN, chatId, 'ℹ️ Necesitas más registros para calcular probabilidades.'); return; }
    const now = new Date();
    const localNow = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600000);
    const day = localNow.getUTCDay();
    const currentHour = localNow.getUTCHours();
    const allDates = outages.filter(o => o.start && o.end && (o.type || 'corte') !== 'fluctuacion').flatMap(o => [new Date(o.start), new Date(o.end)]);
    const earliestDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date(now - 84*86400000);
    const hardWindow = new Date(now); hardWindow.setDate(hardWindow.getDate() - 84);
    const windowStart = new Date(Math.max(earliestDate.getTime(), hardWindow.getTime()));
    const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') !== 'fluctuacion' && new Date(o.start) >= windowStart);
    const slots = {}, observations = {};
    const cur = new Date(windowStart); cur.setHours(0, 0, 0, 0);
    while (cur <= now) {
      for (let h = 0; h < 24; h++) {
        const localCur = new Date(cur.getTime() + TZ_OFFSET_HOURS * 3600000);
        const k = `${localCur.getUTCDay()}_${h}`;
        observations[k] = (observations[k] || 0) + 1;
      }
      cur.setDate(cur.getDate() + 1);
    }
    completed.forEach(o => {
      const s = new Date(o.start), e = new Date(o.end), c = new Date(s); c.setMinutes(0, 0, 0);
      while (c < e) {
        const localC = new Date(c.getTime() + TZ_OFFSET_HOURS * 3600000);
        const k = `${localC.getUTCDay()}_${localC.getUTCHours()}`;
        slots[k] = (slots[k] || 0) + 1;
        c.setHours(c.getHours() + 1);
      }
    });
    const risky = [];
    for (let h = 0; h < 24; h++) {
      const k = `${day}_${h}`;
      const obs = observations[k] || 1, hits = slots[k] || 0;
      const conf = Math.min(obs / WEEKS_FOR_FULL_CONFIDENCE, 1);
      const prob = (hits + 0.5) / (obs + 1);
      const adjusted = conf < 0.15 ? 0 : prob * conf;
      if (adjusted >= 0.18) risky.push({ h, prob: adjusted });
    }
    if (!risky.length) { await tg(env.BOT_TOKEN, chatId, '✅ Sin riesgo significativo hoy según tu historial.'); return; }
    const peak = risky.reduce((a, b) => b.prob > a.prob ? b : a);
    const ranges = []; let rs = null, re = null;
    risky.forEach(({ h }) => {
      if (rs === null) { rs = h; re = h; }
      else if (h === re + 1) { re = h; }
      else { ranges.push([rs, re]); rs = h; re = h; }
    });
    if (rs !== null) ranges.push([rs, re]);
    const rangeText = ranges.map(([a, b]) =>
      a === b ? `${String(a).padStart(2, '0')}:00` : `${String(a).padStart(2, '0')}:00–${String(b + 1).padStart(2, '0')}:00`
    ).join(', ');
    const inRisk = risky.some(p => p.h === currentHour);
    const prefix = inRisk ? '⚠️ *Estás en una hora de riesgo ahora mismo.*\n\n' : '';
    await tg(env.BOT_TOKEN, chatId, `${prefix}🔮 *Predicción para hoy*\n\n⏰ Riesgo: *${rangeText}*\n📈 Pico: *${String(peak.h).padStart(2, '0')}:00* (${Math.round(peak.prob * 100)}%)\n\n_Basado en tu historial personal._`);
    return;
  }

  await tg(env.BOT_TOKEN, chatId, STRINGS.unknown);
}

async function handleCron(env) {
  const r = await fetch(`${API}/api/active-sessions`, {
    headers: { 'x-internal-secret': env.ADMIN_SECRET },
  });
  if (!r.ok) return;
  const sessions = await r.json();
  if (!sessions.length) return;

  const now = Date.now();

  for (const row of sessions) {
    const { telegram_chat_id, start_time } = row;
    if (!telegram_chat_id) continue;
    const elapsedMins = (now - new Date(start_time).getTime()) / 60000;
    const reminderKey = `reminded:${telegram_chat_id}`;
    const alreadySent = await env.KV.get(reminderKey);
    const sentSet = alreadySent ? new Set(JSON.parse(alreadySent)) : new Set();

    for (const reminder of REMINDERS) {
      if (elapsedMins >= reminder.minutes && !sentSet.has(reminder.minutes)) {
        sentSet.add(reminder.minutes);
        await tg(env.BOT_TOKEN, telegram_chat_id, reminder.msg(fmtDuration(elapsedMins)));
        break;
      }
    }

    if (sentSet.size > 0) {
      await env.KV.put(reminderKey, JSON.stringify([...sentSet]), { expirationTtl: 86400 });
    }
  }
}

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('ok');
    const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
    const update = await req.json();
    await handleUpdate(env, update);
    return new Response('ok');
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};
