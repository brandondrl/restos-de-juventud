const API = 'https://restos-de-juventud.vercel.app';
const TZ_OFFSET_HOURS = -4;
const WEEKS_FOR_FULL_CONFIDENCE = 4;
const RISK_THRESHOLD = 0.13;
const WILSON_Z = 1.96;
const CONSECUTIVE_OUTAGE_MIN_SAMPLE = 4;
const CONSECUTIVE_OUTAGE_WINDOW_HOURS = 12;
const CONSECUTIVE_OUTAGE_MAX_ELAPSED_HOURS = 36;

function computeMarginOfError(hits, observations) {
  if (!observations || observations <= 0) return null;
  const pHat = hits / observations;
  const z2 = WILSON_Z * WILSON_Z;
  const denominator = 1 + z2 / observations;
  const margin = (WILSON_Z * Math.sqrt((pHat * (1 - pHat)) / observations + z2 / (4 * observations * observations))) / denominator;
  return Math.round(margin * 100);
}

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
  { minutes: 120, msg: (d) => `⚡ Llevas *${d}* sin luz. Busca cotufas, va pa' rato.` },
  { minutes: 240, msg: (d) => `🕯️ *${d}* sin luz. Ya esto es una odisea. Acomodaste el pasaporte?` },
  { minutes: 300, msg: (d) => `😤 *${d}* sin luz... ¿y el operador? Respira, ya debe faltar poco (aja xD).` },
  { minutes: 360, msg: (d) => `💀 *${d}* SIN LUZ. Vergación nada que vuelve. Racionamiento o aguebamiento? ni modo...` },
];

const STRINGS = {
  welcome: `⚡ *Restos de Juventud Bot*\n\n¿Sin luz otra vez? Este bot te ayuda a registrar cortes sin abrir la app.\n\n*Para vincularte:*\n1. Entra a la app web\n2. Abre tu perfil\n3. Toca *Vincular Telegram*\n4. Usa el botón o manda el código aquí con /start CÓDIGO\n\n_Si no tienes cuenta, regístrate primero en la app._`,
  linked: (u) => `✅ Cuenta *@${u}* vinculada.\n\nYa puedes usar los comandos. Manda /ayuda para verlos.`,
  invalidToken: `❌ Código inválido o expirado.\n\nGenera uno nuevo desde tu perfil en la app.`,
  notLinked: `🔗 Tu cuenta no está vinculada.\n\nEntra a la app, abre tu perfil y toca *Vincular Telegram* para obtener un código de acceso.`,
  outageStarted: (t, summary) => `⚡ Corte registrado a las *${t}*\n${summary}\nUsa /volvio cuando regrese la luz.`,
  outageAlreadyActive: (t) => `⚠️ Ya tienes un corte activo desde las *${t}*\n\nUsa /volvio cuando regrese la luz.`,
  askMood: MOOD_PROMPT,
  outageEnded: (d, mood, summary) => `💡 Luz de vuelta. Duración: *${d}*\nEstado: ${MOOD_LABELS[mood]}\n\n${summary}`,
  moodInvalid: `Responde solo con un número del 1 al 5.`,
  noActiveOutage: `ℹ️ No hay corte activo registrado.\n\nUsa /corte si se fue la luz.`,
  statusOff: `💡 Con luz`,
  fluctuationSaved: (t) => `🔌 Fluctuación registrada a las *${t}*`,
  fluctuationDuringOutage: `⚠️ No puedes registrar una fluctuación con un corte activo.`,
  error: `❌ Error. Intenta de nuevo.`,
  duplicate: `⏳ Ya registré esa acción. Espera un momento.`,
  disconnected: (summary) => `🔌 Cuenta desvinculada.\n\n${summary}\n\nHasta la próxima apagón 👋`,
  groupOnly: `Para vincular tu cuenta háblame en privado 👉`,
  unknown: `Comando no reconocido.\n\nUsa /ayuda para ver los comandos disponibles.`,
  help: `⚡ *Comandos disponibles*\n\n/corte — Se fue la luz\n/volvio — Volvió la luz\n/fluctuacion — Bajón o pico rápido\n/estado — Ver estado actual\n/hoy — Resumen del día\n/semana — Resumen de esta semana\n/mes — Resumen de este mes\n/probabilidad — Riesgo de corte hoy\n/resetpass — Cambiar contraseña\n/ayuda — Esta lista\n/desconectar — Desvincular cuenta`,
};

function localTime(date = new Date()) {
  const local = new Date(date.getTime() + TZ_OFFSET_HOURS * 3600000);
  const h = String(local.getUTCHours()).padStart(2, '0');
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function fmtDuration(mins) {
  if (!mins || mins <= 0) return '0m';
  const total = Math.round(mins);
  const h = Math.floor(total / 60), m = total % 60;
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

async function handleTokenLink(env, userId, token) {
  const r = await fetch(`${API}/api/auth/telegram-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.toUpperCase(), chat_id: userId }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.ok) return null;
  await env.KV.put(`session:${userId}`, data.token, { expirationTtl: 31536000 });
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
  const parts = text.split(' ');
  const rawCmd = parts[0].toLowerCase();
  const cmd = rawCmd.replace(`@${(env.BOT_USERNAME || '').toLowerCase()}`, '');

  if (cmd === '/start') {
    if (isGroup) {
      await tg(env.BOT_TOKEN, chatId, `${STRINGS.groupOnly} @${env.BOT_USERNAME}`);
      return;
    }
    const tokenArg = parts[1];
    if (tokenArg) {
      const linked = await handleTokenLink(env, userId, tokenArg);
      if (linked) {
        await tg(env.BOT_TOKEN, chatId, STRINGS.linked(linked));
      } else {
        await tgButtons(env.BOT_TOKEN, chatId, STRINGS.invalidToken, [
          [{ text: '🌐 Ir a la app', url: API }],
        ]);
      }
      return;
    }
    await tgButtons(env.BOT_TOKEN, chatId, STRINGS.welcome, [
      [{ text: '🌐 Ir a la app', url: API }],
    ]);
    return;
  }

  if (cmd === '/ayuda') {
    await tg(env.BOT_TOKEN, chatId, STRINGS.help);
    return;
  }

  const session = await getSession(env.KV, userId);

  const pendingMoodRaw = await env.KV.get(`pending_mood:${userId}`);
  if (pendingMoodRaw && session && !cmd.startsWith('/')) {
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
    const localNowClose = new Date(new Date().getTime() + TZ_OFFSET_HOURS * 3600000);
    const todayClose = localNowClose.toISOString().slice(0, 10);
    await env.KV.put(`closed_today:${userId}:${todayClose}`, '1', { expirationTtl: 86400 });
    const outages = await apiGet('/api/outages', session);
    const summary = outages ? buildDaySummary(outages) : '';
    const consecutiveStatus = outages ? getConsecutiveOutageStatus(outages, endTime) : null;
    const consecutiveLine = consecutiveStatus
      ? `\n\n${consecutiveStatus.level === 'bajo' ? '💤' : '⚠️'} Históricamente, *${consecutiveStatus.percent}%* de probabilidad de otro corte en las próximas ${consecutiveStatus.hoursAhead}h.`
      : '';
    await tg(env.BOT_TOKEN, chatId, STRINGS.outageEnded(fmtDuration(mins), moodValue, summary) + consecutiveLine);
    return;
  }

  if (!session) {
    await tgButtons(env.BOT_TOKEN, chatId, STRINGS.notLinked, [
      [{ text: '🌐 Ir a la app', url: API }],
    ]);
    return;
  }

  if (cmd === '/desconectar') {
    let summary = '';
    const outages = await apiGet('/api/outages', session);
    if (outages) {
      const total = outages.filter(o => o.end && (o.type || 'corte') === 'corte');
      const mins = total.reduce((s, o) => s + (o.duration_minutes || 0), 0);
      summary = `Registraste *${total.length}* cortes · *${fmtDuration(mins)}* sin luz en total.`;
    }
    await env.KV.delete(`session:${userId}`);
    await env.KV.delete(`pending_mood:${userId}`);
    await tg(env.BOT_TOKEN, chatId, STRINGS.disconnected(summary));
    return;
  }

  if (cmd === '/corte') {
    if (await isDuplicate(env.KV, userId, 'start')) { await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate); return; }
    const active = await apiGet('/api/active', session);
    if (active) { await tg(env.BOT_TOKEN, chatId, STRINGS.outageAlreadyActive(localTime(new Date(active.start)))); return; }
    const now = new Date();
    const outage = { id: generateId(), start: now.toISOString() };
    const ok = await apiPost('/api/active', outage, session);
    if (!ok) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    await env.KV.delete(`reminded:${userId}`);
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
          ? `\n⏳ Estimado restante: *${fmtDuration(remaining)}* (promedio: ${fmtDuration(avg)})`
          : `\n⚠️ Superó el promedio histórico de *${fmtDuration(avg)}*`;
      }
    }
    await tgButtons(env.BOT_TOKEN, chatId,
      `⚡ Sin luz desde las *${localTime(new Date(active.start))}*\nLlevas *${fmtDuration(elapsed)}* sin luz${etaLine}`,
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
    const localNowPeriod = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600000);
    let cutoff;
    if (cmd === '/semana') {
      const day = localNowPeriod.getUTCDay();
      const daysBack = day === 0 ? 6 : day - 1;
      const localMon = new Date(localNowPeriod);
      localMon.setUTCDate(localNowPeriod.getUTCDate() - daysBack);
      localMon.setUTCHours(0, 0, 0, 0);
      cutoff = new Date(localMon.getTime() - TZ_OFFSET_HOURS * 3600000);
    } else {
      const localFirst = new Date(localNowPeriod);
      localFirst.setUTCDate(1);
      localFirst.setUTCHours(0, 0, 0, 0);
      cutoff = new Date(localFirst.getTime() - TZ_OFFSET_HOURS * 3600000);
    }
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
    const currentHour = localNow.getUTCHours();
    const risk = calculateDayRisk(outages, localNow);
    if (!risk) { await tg(env.BOT_TOKEN, chatId, '✅ Sin riesgo significativo hoy según tu historial.'); return; }
    const inRisk = risk.risky.some(p => p.h === currentHour);
    const prefix = inRisk ? '⚠️ *Estás en una hora de riesgo ahora mismo.*\n\n' : '';
    await tg(env.BOT_TOKEN, chatId, `${prefix}🔮 *Predicción para hoy*\n\n⏰ Riesgo: *${risk.rangeText}*\n📈 Pico: *${String(risk.peak.h).padStart(2, '0')}:00* (${Math.round(risk.peak.prob * 100)}%${risk.marginOfError != null ? ` ±${risk.marginOfError}%` : ''})\n\n_Basado en tu historial personal._`);
    return;
  }

  if (cmd === '/resetpass') {
    if (!session) { await tg(env.BOT_TOKEN, chatId, STRINGS.notLinked); return; }
    const r = await fetch(`${API}/api/auth/reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `auth=${session}` },
    });
    if (!r.ok) { await tg(env.BOT_TOKEN, chatId, STRINGS.error); return; }
    const { token } = await r.json();
    await tg(env.BOT_TOKEN, chatId, `🔑 *Cambio de contraseña*\n\nAbre este enlace (válido 15 min):\n${API}?reset=${token}\n\n_No lo compartas con nadie._`);
    return;
  }

  await tg(env.BOT_TOKEN, chatId, STRINGS.unknown);
}

function calculateDayRisk(outages, localNow) {
  const day = localNow.getUTCDay();
  const now = new Date();
  const allDates = outages.filter(o => o.start && o.end && (o.type || 'corte') !== 'fluctuacion').flatMap(o => [new Date(o.start), new Date(o.end)]);
  if (!allDates.length) return null;
  const earliestDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const hardWindow = new Date(now); hardWindow.setDate(hardWindow.getDate() - 84);
  const windowStart = new Date(Math.max(earliestDate.getTime(), hardWindow.getTime()));
  const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') !== 'fluctuacion' && new Date(o.start) >= windowStart);
  const slots = {}, observations = {};
  const cur = new Date(windowStart); cur.setHours(0, 0, 0, 0);
  while (cur <= now) {
    for (let h = 0; h < 24; h++) {
      const localH = new Date(cur.getTime() + TZ_OFFSET_HOURS * 3600000 + h * 3600000);
      const k = `${localH.getUTCDay()}_${localH.getUTCHours()}`;
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
  const rawProbability = h => {
    const k = `${day}_${h}`;
    const obs = observations[k] || 0;
    const hits = slots[k] || 0;
    return obs > 0 ? (hits + 0.5) / (obs + 1) : 0;
  };
  const confidenceOf = h => Math.min((observations[`${day}_${h}`] || 0) / WEEKS_FOR_FULL_CONFIDENCE, 1);
  const risky = [];
  for (let h = 0; h < 24; h++) {
    const smoothedProbability = (rawProbability((h + 23) % 24) + rawProbability(h) * 2 + rawProbability((h + 1) % 24)) / 4;
    const conf = confidenceOf(h);
    const adjusted = conf < 0.15 ? 0 : smoothedProbability * conf;
    const k = `${day}_${h}`;
    if (adjusted >= RISK_THRESHOLD) risky.push({ h, prob: adjusted, hits: slots[k] || 0, obs: observations[k] || 0 });
  }
  if (!risky.length) return null;
  const peak = risky.reduce((a, b) => b.prob > a.prob ? b : a);
  const marginOfError = computeMarginOfError(peak.hits, peak.obs);
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
  return { risky, peak, rangeText, marginOfError };
}

function getConsecutiveOutageStatus(outages, now) {
  const completed = outages
    .filter(o => o.start && o.end && (o.type || 'corte') === 'corte')
    .map(o => ({ start: new Date(o.start), end: new Date(o.end) }))
    .sort((a, b) => a.start - b.start);
  if (!completed.length) return null;
  const gaps = [];
  for (let i = 1; i < completed.length; i++) {
    const hours = (completed[i].start - completed[i - 1].end) / 3600000;
    if (hours >= 0) gaps.push(hours);
  }
  if (gaps.length < CONSECUTIVE_OUTAGE_MIN_SAMPLE) return null;
  const lastEnd = completed[completed.length - 1].end;
  const hoursElapsed = (now - lastEnd) / 3600000;
  if (hoursElapsed < 0 || hoursElapsed > CONSECUTIVE_OUTAGE_MAX_ELAPSED_HOURS) return null;
  const eligible = gaps.filter(g => g >= hoursElapsed);
  if (eligible.length < CONSECUTIVE_OUTAGE_MIN_SAMPLE) return null;
  const within = eligible.filter(g => g <= hoursElapsed + CONSECUTIVE_OUTAGE_WINDOW_HOURS).length;
  const probability = (within + 0.5) / (eligible.length + 1);
  const percent = Math.round(probability * 100);
  const level = percent < 15 ? 'bajo' : percent < 35 ? 'moderado' : 'alto';
  return { percent, level, hoursAhead: CONSECUTIVE_OUTAGE_WINDOW_HOURS, sampleSize: eligible.length };
}

async function handleCron(env) {
  const now = Date.now();
  const localNow = new Date(now + TZ_OFFSET_HOURS * 3600000);
  const localHour = localNow.getUTCHours();
  const localMinute = localNow.getUTCMinutes();
  const today = localNow.toISOString().slice(0, 10);

  const activeR = await fetch(`${API}/api/active-sessions`, {
    headers: { 'x-internal-secret': env.ADMIN_SECRET },
  });
  if (activeR.ok) {
    const sessions = await activeR.json();
    for (const row of sessions) {
      const { telegram_chat_id, start_time, outage_id } = row;
      if (!telegram_chat_id) continue;
      const elapsedMins = (now - new Date(start_time).getTime()) / 60000;
      const reminderKey = `reminded:${telegram_chat_id}`;
      const stored = await env.KV.get(reminderKey);
      let sentSet = new Set();
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.outageId === outage_id) sentSet = new Set(parsed.sent);
        } catch { /* stale format, fresh start */ }
      }
      let sentNew = false;
      for (const reminder of REMINDERS) {
        if (elapsedMins >= reminder.minutes && !sentSet.has(reminder.minutes)) {
          sentSet.add(reminder.minutes);
          await tg(env.BOT_TOKEN, telegram_chat_id, reminder.msg(fmtDuration(elapsedMins)));
          sentNew = true;
          break;
        }
      }
      if (sentNew || sentSet.size > 0) {
        await env.KV.put(reminderKey, JSON.stringify({ outageId: outage_id, sent: [...sentSet] }), { expirationTtl: 86400 });
      }
    }
  }

  if (localHour < 5 || localHour > 23) return;

  const usersR = await fetch(`${API}/api/telegram-users`, {
    headers: { 'x-internal-secret': env.ADMIN_SECRET },
  });
  if (!usersR.ok) return;
  const users = await usersR.json();

  for (const user of users) {
    const { telegram_chat_id, push_subscription } = user;
    const session = await env.KV.get(`session:${telegram_chat_id}`);
    if (!session) continue;

    const closedToday = await env.KV.get(`closed_today:${telegram_chat_id}:${today}`);
    if (closedToday) continue;

    const outages = await apiGet('/api/outages', session);
    if (!outages || outages.length < 3) continue;

    const activeNow = await apiGet('/api/active', session);
    if (activeNow) continue;

    const startOfTodayUTC = new Date(`${today}T${String(Math.abs(TZ_OFFSET_HOURS)).padStart(2,'0')}:00:00Z`);
    const hadOutageToday = outages.some(o =>
      (o.type || 'corte') === 'corte' && new Date(o.start) >= startOfTodayUTC
    );
    if (hadOutageToday) continue;

    const risk = calculateDayRisk(outages, localNow);
    if (!risk) continue;

    const notifBase = `notif:${telegram_chat_id}:${today}`;

    async function sendAlert(key, tgMsg, pushTitle, pushBody) {
      if (await env.KV.get(key)) return;
      if (telegram_chat_id) await tg(env.BOT_TOKEN, telegram_chat_id, tgMsg);
      if (push_subscription) {
        try {
          await fetch(`${API}/api/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': env.ADMIN_SECRET },
            body: JSON.stringify({ subscription: JSON.parse(push_subscription), title: pushTitle, body: pushBody }),
          });
        } catch {}
      }
      await env.KV.put(key, '1', { expirationTtl: 86400 });
    }

    if (localHour === 9 && localMinute < 5) {
      await sendAlert(
        `${notifBase}:morning`,
        `🌅 *Buenos días*\n\nSegún tu historial, hoy hay riesgo entre las *${risk.rangeText}*\nPico: *${String(risk.peak.h).padStart(2,'0')}:00* (${Math.round(risk.peak.prob * 100)}%)\n\n_Ojo pelao._`,
        '🌅 Riesgo de corte hoy',
        `Según tu historial: ${risk.rangeText} — pico ${Math.round(risk.peak.prob * 100)}%`
      );
    }

    if (localHour === risk.peak.h - 1 && localMinute < 5) {
      await sendAlert(
        `${notifBase}:prehour`,
        `⏰ En 1 hora entra la hora pico (*${String(risk.peak.h).padStart(2,'0')}:00*) según tu historial. Por si las moscas.`,
        '⏰ Hora pico en 1 hora',
        `${String(risk.peak.h).padStart(2,'0')}:00 — ${Math.round(risk.peak.prob * 100)}% de probabilidad`
      );
    }

    if (localHour === risk.peak.h && localMinute < 5) {
      await sendAlert(
        `${notifBase}:peakhour`,
        `⚡ *Hora pico ahora* (${Math.round(risk.peak.prob * 100)}%)\n\nSi se va, usa /corte para registrarlo.`,
        '⚡ Hora pico ahora',
        `${Math.round(risk.peak.prob * 100)}% de probabilidad. Si se va, registra el corte.`
      );
    }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/invalidate' && req.method === 'POST') {
      if (req.headers.get('x-internal-secret') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const { chat_id } = await req.json();
      if (chat_id) {
        await tg(env.BOT_TOKEN, chat_id, '🔌 Cuenta desvinculada. Ya no recibirás notificaciones de este bot.\n\nSi quieres vincular de nuevo, genera un código desde tu perfil en la app.');
      }
      await env.KV.delete(`session:${chat_id}`);
      await env.KV.delete(`pending_mood:${chat_id}`);
      await env.KV.delete(`reminded:${chat_id}`);
      return new Response('ok');
    }

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
