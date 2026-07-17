var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var API = "https://restos-de-juventud.vercel.app";
var TZ_OFFSET_HOURS = -4;
var WEEKS_FOR_FULL_CONFIDENCE = 4;
var RISK_THRESHOLD = 0.13;
var WILSON_Z = 1.96;
var CONSECUTIVE_OUTAGE_MIN_SAMPLE = 4;
var CONSECUTIVE_OUTAGE_WINDOW_HOURS = 12;
var CONSECUTIVE_OUTAGE_MAX_ELAPSED_HOURS = 36;
function computeMarginOfError(hits, observations) {
  if (!observations || observations <= 0) return null;
  const pHat = hits / observations;
  const z2 = WILSON_Z * WILSON_Z;
  const denominator = 1 + z2 / observations;
  const margin = WILSON_Z * Math.sqrt(pHat * (1 - pHat) / observations + z2 / (4 * observations * observations)) / denominator;
  return Math.round(margin * 100);
}
__name(computeMarginOfError, "computeMarginOfError");
var MOOD_PROMPT = `\xBFC\xF3mo te quedaste con este corte?

1\uFE0F\u20E3 \u{1F621} Arrecho
2\uFE0F\u20E3 \u{1F622} Triste
3\uFE0F\u20E3 \u{1F624} Frustrado
4\uFE0F\u20E3 \u{1F610} Normal
5\uFE0F\u20E3 \u{1F60A} Feliz

_Responde con un n\xFAmero del 1 al 5. Sin esto no se cierra el registro._`;
var MOOD_MAP = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };
var MOOD_LABELS = { 1: "\u{1F621} Arrecho", 2: "\u{1F622} Triste", 3: "\u{1F624} Frustrado", 4: "\u{1F610} Normal", 5: "\u{1F60A} Feliz" };
var REMINDERS = [
  { minutes: 120, msg: /* @__PURE__ */ __name((d) => `\u26A1 Llevas *${d}* sin luz. Busca cotufas, va pa' rato.`, "msg") },
  { minutes: 240, msg: /* @__PURE__ */ __name((d) => `\u{1F56F}\uFE0F *${d}* sin luz. Ya esto es una odisea. Acomodaste el pasaporte?`, "msg") },
  { minutes: 300, msg: /* @__PURE__ */ __name((d) => `\u{1F624} *${d}* sin luz... \xBFy el operador? Respira, ya debe faltar poco (aja xD).`, "msg") },
  { minutes: 360, msg: /* @__PURE__ */ __name((d) => `\u{1F480} *${d}* SIN LUZ. Vergaci\xF3n nada que vuelve. Racionamiento o aguebamiento? ni modo...`, "msg") }
];
var STRINGS = {
  welcome: `\u26A1 *Restos de Juventud Bot*

\xBFSin luz otra vez? Este bot te ayuda a registrar cortes sin abrir la app.

*Para vincularte:*
1. Entra a la app web
2. Abre tu perfil
3. Toca *Vincular Telegram*
4. Usa el bot\xF3n o manda el c\xF3digo aqu\xED con /start C\xD3DIGO

_Si no tienes cuenta, reg\xEDstrate primero en la app._`,
  linked: /* @__PURE__ */ __name((u) => `\u2705 Cuenta *@${u}* vinculada.

Ya puedes usar los comandos. Manda /ayuda para verlos.`, "linked"),
  invalidToken: `\u274C C\xF3digo inv\xE1lido o expirado.

Genera uno nuevo desde tu perfil en la app.`,
  notLinked: `\u{1F517} Tu cuenta no est\xE1 vinculada.

Entra a la app, abre tu perfil y toca *Vincular Telegram* para obtener un c\xF3digo de acceso.`,
  outageStarted: /* @__PURE__ */ __name((t, summary) => `\u26A1 Corte registrado a las *${t}*
${summary}
Usa /volvio cuando regrese la luz.`, "outageStarted"),
  outageAlreadyActive: /* @__PURE__ */ __name((t) => `\u26A0\uFE0F Ya tienes un corte activo desde las *${t}*

Usa /volvio cuando regrese la luz.`, "outageAlreadyActive"),
  askMood: MOOD_PROMPT,
  outageEnded: /* @__PURE__ */ __name((d, mood, summary) => `\u{1F4A1} Luz de vuelta. Duraci\xF3n: *${d}*
Estado: ${MOOD_LABELS[mood]}

${summary}`, "outageEnded"),
  moodInvalid: `Responde solo con un n\xFAmero del 1 al 5.`,
  noActiveOutage: `\u2139\uFE0F No hay corte activo registrado.

Usa /corte si se fue la luz.`,
  statusOff: `\u{1F4A1} Con luz`,
  fluctuationSaved: /* @__PURE__ */ __name((t) => `\u{1F50C} Fluctuaci\xF3n registrada a las *${t}*`, "fluctuationSaved"),
  fluctuationDuringOutage: `\u26A0\uFE0F No puedes registrar una fluctuaci\xF3n con un corte activo.`,
  error: `\u274C Error. Intenta de nuevo.`,
  duplicate: `\u23F3 Ya registr\xE9 esa acci\xF3n. Espera un momento.`,
  disconnected: /* @__PURE__ */ __name((summary) => `\u{1F50C} Cuenta desvinculada.

${summary}

Hasta la pr\xF3xima apag\xF3n \u{1F44B}`, "disconnected"),
  groupOnly: `Para vincular tu cuenta h\xE1blame en privado \u{1F449}`,
  unknown: `Comando no reconocido.

Usa /ayuda para ver los comandos disponibles.`,
  unauthorized: `\u{1F511} Sesi\xF3n expirada. Usa /renovar para renovarla o /desconectar y vuelve a vincular desde la app.`,
  renewOk: `\u2705 Sesi\xF3n renovada. Tus tokens estar\xE1n vigentes por un a\xF1o m\xE1s.`,
  renewFail: `\u274C No se pudo renovar la sesi\xF3n. Usa /desconectar y vuelve a vincular desde la app.`,
  help: `\u26A1 *Comandos disponibles*

/corte \u2014 Se fue la luz
/volvio \u2014 Volvi\xF3 la luz
/fluctuacion \u2014 Baj\xF3n o pico r\xE1pido
/estado \u2014 Ver estado actual
/hoy \u2014 Resumen del d\xEDa
/semana \u2014 Resumen de esta semana
/mes \u2014 Resumen de este mes
/probabilidad \u2014 Riesgo de corte hoy
/resetpass \u2014 Cambiar contrase\xF1a
/ayuda \u2014 Esta lista
/desconectar \u2014 Desvincular cuenta`
};
function localTime(date = /* @__PURE__ */ new Date()) {
  const local = new Date(date.getTime() + TZ_OFFSET_HOURS * 36e5);
  const h = String(local.getUTCHours()).padStart(2, "0");
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
__name(localTime, "localTime");
function fmtDuration(mins) {
  if (!mins || mins <= 0) return "0m";
  const total = Math.round(mins);
  const h = Math.floor(total / 60), m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}
__name(fmtDuration, "fmtDuration");
function dedupeKey(userId, cmd) {
  const bucket = Math.floor(Date.now() / 9e4);
  return `dedup:${userId}:${cmd}:${bucket}`;
}
__name(dedupeKey, "dedupeKey");
async function isDuplicate(kv, userId, cmd) {
  const key = dedupeKey(userId, cmd);
  const val = await kv.get(key);
  if (val) return true;
  await kv.put(key, "1", { expirationTtl: 90 });
  return false;
}
__name(isDuplicate, "isDuplicate");
function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
__name(generateId, "generateId");
async function tg(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  });
}
__name(tg, "tg");
async function tgButtons(botToken, chatId, text, buttons) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons }
    })
  });
}
__name(tgButtons, "tgButtons");
async function apiGet(path, token) {
  const r = await fetch(`${API}${path}`, { headers: { Cookie: `auth=${token}` } });
  if (!r.ok) return null;
  return r.json();
}
__name(apiGet, "apiGet");
async function apiPost(path, body, token) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `auth=${token}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) return null;
  return r.json();
}
__name(apiPost, "apiPost");
async function apiPostRaw(path, body, token) {
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `auth=${token}` },
    body: JSON.stringify(body)
  });
}
__name(apiPostRaw, "apiPostRaw");
async function apiDelete(path, token) {
  const r = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { Cookie: `auth=${token}` }
  });
  return r.ok;
}
__name(apiDelete, "apiDelete");
async function getSession(kv, userId) {
  return kv.get(`session:${userId}`);
}
__name(getSession, "getSession");
function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}
__name(decodeToken, "decodeToken");
async function refreshSession(env, userId, currentToken) {
  const r = await fetch(`${API}/api/auth?action=refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentToken}`
    }
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.token) return null;
  await env.KV.put(`session:${userId}`, data.token, { expirationTtl: 31536e3 });
  return data.token;
}
__name(refreshSession, "refreshSession");
async function handleTokenLink(env, userId, token) {
  const r = await fetch(`${API}/api/auth/telegram-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.toUpperCase(), chat_id: userId })
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.ok) return null;
  await env.KV.put(`session:${userId}`, data.token, { expirationTtl: 31536e3 });
  return data.username;
}
__name(handleTokenLink, "handleTokenLink");
function buildDaySummary(outages) {
  const now = /* @__PURE__ */ new Date();
  const localNow = new Date(now.getTime() + TZ_OFFSET_HOURS * 36e5);
  const startOfToday = new Date(localNow);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTodayUTC = new Date(startOfToday.getTime() - TZ_OFFSET_HOURS * 36e5);
  const todayCortes = outages.filter(
    (o) => o.end && (o.type || "corte") === "corte" && new Date(o.start) >= startOfTodayUTC
  );
  const todayFlucs = outages.filter(
    (o) => (o.type || "corte") === "fluctuacion" && new Date(o.start) >= startOfTodayUTC
  );
  const totalMins = todayCortes.reduce((s, o) => s + (o.duration_minutes || 0), 0);
  if (!todayCortes.length && !todayFlucs.length) return `\u{1F4CB} Hoy: sin cortes registrados a\xFAn.`;
  const parts = [];
  if (todayCortes.length) parts.push(`${todayCortes.length} corte${todayCortes.length !== 1 ? "s" : ""} \xB7 ${fmtDuration(totalMins)}`);
  if (todayFlucs.length) parts.push(`${todayFlucs.length} fluctuaci\xF3n${todayFlucs.length !== 1 ? "es" : ""}`);
  return `\u{1F4CB} Hoy: ${parts.join(" \xB7 ")}`;
}
__name(buildDaySummary, "buildDaySummary");
async function handleUpdate(env, update) {
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId2 = cb.from.id;
    const chatId2 = cb.message.chat.id;
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cb.id })
    });
    await handleUpdate(env, {
      message: {
        from: { id: userId2 },
        chat: { id: chatId2, type: "private" },
        text: cb.data
      }
    });
    return;
  }
  const msg = update.message;
  if (!msg || !msg.text) return;
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  const text = msg.text.trim();
  const parts = text.split(" ");
  const rawCmd = parts[0].toLowerCase();
  const cmd = rawCmd.replace(`@${(env.BOT_USERNAME || "").toLowerCase()}`, "");
  if (cmd === "/start") {
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
          [{ text: "\u{1F310} Ir a la app", url: API }]
        ]);
      }
      return;
    }
    await tgButtons(env.BOT_TOKEN, chatId, STRINGS.welcome, [
      [{ text: "\u{1F310} Ir a la app", url: API }]
    ]);
    return;
  }
  if (cmd === "/ayuda") {
    await tg(env.BOT_TOKEN, chatId, STRINGS.help);
    return;
  }
  let session = await getSession(env.KV, userId);
  if (session) {
    const payload = decodeToken(session);
    if (payload && payload.exp) {
      const expIn = payload.exp - Math.floor(Date.now() / 1e3);
      if (expIn < 86400) {
        const refreshed = await refreshSession(env, userId, session);
        if (refreshed) session = refreshed;
        else if (expIn <= 0) session = null;
      }
    }
  }
  const pendingMoodRaw = await env.KV.get(`pending_mood:${userId}`);
  if (pendingMoodRaw && session && !cmd.startsWith("/")) {
    const moodValue = MOOD_MAP[text];
    if (!moodValue) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.moodInvalid);
      return;
    }
    let pending;
    try {
      pending = JSON.parse(pendingMoodRaw);
    } catch {
      await tg(env.BOT_TOKEN, chatId, STRINGS.error);
      return;
    }
    const endTime = /* @__PURE__ */ new Date();
    const startTime = new Date(pending.outageStart);
    const mins = (endTime - startTime) / 6e4;
    const outage = { id: pending.outageId, start: pending.outageStart, end: endTime.toISOString(), duration_minutes: mins, type: "corte", mood: moodValue };
    const saveRes = await apiPostRaw("/api/outages", outage, session);
    if (saveRes.status === 401) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.unauthorized);
      return;
    }
    if (!saveRes.ok) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.error);
      return;
    }
    await apiDelete("/api/active", session);
    await env.KV.delete(`pending_mood:${userId}`);
    await env.KV.delete(`reminded:${userId}`);
    const localNowClose = new Date((/* @__PURE__ */ new Date()).getTime() + TZ_OFFSET_HOURS * 36e5);
    const todayClose = localNowClose.toISOString().slice(0, 10);
    await env.KV.put(`closed_today:${userId}:${todayClose}`, "1", { expirationTtl: 86400 });
    const outages = await apiGet("/api/outages", session);
    const summary = outages ? buildDaySummary(outages) : "";
    const consecutiveStatus = outages ? getConsecutiveOutageStatus(outages, endTime) : null;
    const consecutiveLine = consecutiveStatus ? `

${consecutiveStatus.level === "bajo" ? "\u{1F4A4}" : "\u26A0\uFE0F"} Hist\xF3ricamente, *${consecutiveStatus.percent}%* de probabilidad de otro corte en las pr\xF3ximas ${consecutiveStatus.hoursAhead}h.` : "";
    await tg(env.BOT_TOKEN, chatId, STRINGS.outageEnded(fmtDuration(mins), moodValue, summary) + consecutiveLine);
    return;
  }
  if (!session) {
    await tgButtons(env.BOT_TOKEN, chatId, STRINGS.notLinked, [
      [{ text: "\u{1F310} Ir a la app", url: API }]
    ]);
    return;
  }
  if (cmd === "/desconectar") {
    let summary = "";
    const outages = await apiGet("/api/outages", session);
    if (outages) {
      const total = outages.filter((o) => o.end && (o.type || "corte") === "corte");
      const mins = total.reduce((s, o) => s + (o.duration_minutes || 0), 0);
      summary = `Registraste *${total.length}* cortes \xB7 *${fmtDuration(mins)}* sin luz en total.`;
    }
    await apiPost("/api/auth/telegram-unlink", {}, session);
    await env.KV.delete(`session:${userId}`);
    await env.KV.delete(`pending_mood:${userId}`);
    await tg(env.BOT_TOKEN, chatId, STRINGS.disconnected(summary));
    return;
  }
  if (cmd === "/corte") {
    if (await isDuplicate(env.KV, userId, "start")) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet("/api/active", session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.outageAlreadyActive(localTime(new Date(active.start))));
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const outage = { id: generateId(), start: now.toISOString() };
    const startRes = await apiPostRaw("/api/active", outage, session);
    if (startRes.status === 401) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.unauthorized);
      return;
    }
    if (!startRes.ok) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.error);
      return;
    }
    await env.KV.delete(`reminded:${userId}`);
    const outages = await apiGet("/api/outages", session);
    const summary = outages ? buildDaySummary(outages) : "";
    await tgButtons(env.BOT_TOKEN, chatId, STRINGS.outageStarted(localTime(now), summary), [
      [{ text: "\u{1F4A1} Ya volvi\xF3 la luz", callback_data: "/volvio" }]
    ]);
    return;
  }
  if (cmd === "/volvio") {
    if (await isDuplicate(env.KV, userId, "end")) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet("/api/active", session);
    if (!active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.noActiveOutage);
      return;
    }
    await env.KV.put(
      `pending_mood:${userId}`,
      JSON.stringify({ outageId: active.id, outageStart: active.start }),
      { expirationTtl: 300 }
    );
    await tg(env.BOT_TOKEN, chatId, STRINGS.askMood);
    return;
  }
  if (cmd === "/estado") {
    const active = await apiGet("/api/active", session);
    if (!active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.statusOff);
      return;
    }
    const elapsed = (Date.now() - new Date(active.start).getTime()) / 6e4;
    const outagesForEta = await apiGet("/api/outages", session);
    let etaLine = "";
    if (outagesForEta) {
      const completed = outagesForEta.filter((o) => o.end && (o.type || "corte") === "corte" && o.duration_minutes > 0);
      if (completed.length >= 2) {
        const avg = completed.reduce((s, o) => s + o.duration_minutes, 0) / completed.length;
        const remaining = avg - elapsed;
        etaLine = remaining > 0 ? `
\u23F3 Estimado restante: *${fmtDuration(remaining)}* (promedio: ${fmtDuration(avg)})` : `
\u26A0\uFE0F Super\xF3 el promedio hist\xF3rico de *${fmtDuration(avg)}*`;
      }
    }
    await tgButtons(
      env.BOT_TOKEN,
      chatId,
      `\u26A1 Sin luz desde las *${localTime(new Date(active.start))}*
Llevas *${fmtDuration(elapsed)}* sin luz${etaLine}`,
      [[{ text: "\u{1F4A1} Ya volvi\xF3 la luz", callback_data: "/volvio" }]]
    );
    return;
  }
  if (cmd === "/fluctuacion") {
    if (await isDuplicate(env.KV, userId, "fluc")) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.duplicate);
      return;
    }
    const active = await apiGet("/api/active", session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.fluctuationDuringOutage);
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const fluc = { id: generateId(), start: now.toISOString(), end: now.toISOString(), duration_minutes: 0, type: "fluctuacion" };
    const flucRes = await apiPostRaw("/api/outages", fluc, session);
    if (flucRes.status === 401) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.unauthorized);
      return;
    }
    if (!flucRes.ok) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.error);
      return;
    }
    await tg(env.BOT_TOKEN, chatId, STRINGS.fluctuationSaved(localTime(now)));
    return;
  }
  if (cmd === "/hoy") {
    const outages = await apiGet("/api/outages", session);
    if (!outages) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.error);
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const localNowHoy = new Date(now.getTime() + TZ_OFFSET_HOURS * 36e5);
    const startOfTodayLocal = new Date(localNowHoy);
    startOfTodayLocal.setUTCHours(0, 0, 0, 0);
    const startOfToday = new Date(startOfTodayLocal.getTime() - TZ_OFFSET_HOURS * 36e5);
    const active = await apiGet("/api/active", session);
    const todayCortes = outages.filter((o) => o.end && (o.type || "corte") === "corte" && new Date(o.start) >= startOfToday);
    const todayFlucs = outages.filter((o) => (o.type || "corte") === "fluctuacion" && new Date(o.start) >= startOfToday);
    const totalMins = todayCortes.reduce((s, o) => s + (o.duration_minutes || 0), 0);
    let reply = `\u{1F4C5} *Hoy*

`;
    if (active) reply += `\u26A1 Corte activo desde las ${localTime(new Date(active.start))}
`;
    reply += `\u{1F534} Cortes: *${todayCortes.length}* \xB7 ${fmtDuration(totalMins)}
`;
    reply += `\u{1F50C} Fluctuaciones: *${todayFlucs.length}*`;
    if (!todayCortes.length && !todayFlucs.length && !active) reply += `

\u2705 Sin incidencias hoy.`;
    await tg(env.BOT_TOKEN, chatId, reply);
    return;
  }
  if (cmd === "/semana" || cmd === "/mes") {
    const outages = await apiGet("/api/outages", session);
    if (!outages) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.error);
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const localNowPeriod = new Date(now.getTime() + TZ_OFFSET_HOURS * 36e5);
    let cutoff;
    if (cmd === "/semana") {
      const day = localNowPeriod.getUTCDay();
      const daysBack = day === 0 ? 6 : day - 1;
      const localMon = new Date(localNowPeriod);
      localMon.setUTCDate(localNowPeriod.getUTCDate() - daysBack);
      localMon.setUTCHours(0, 0, 0, 0);
      cutoff = new Date(localMon.getTime() - TZ_OFFSET_HOURS * 36e5);
    } else {
      const localFirst = new Date(localNowPeriod);
      localFirst.setUTCDate(1);
      localFirst.setUTCHours(0, 0, 0, 0);
      cutoff = new Date(localFirst.getTime() - TZ_OFFSET_HOURS * 36e5);
    }
    const period = outages.filter((o) => o.end && (o.type || "corte") === "corte" && new Date(o.start) >= cutoff);
    const flucs = outages.filter((o) => (o.type || "corte") === "fluctuacion" && new Date(o.start) >= cutoff);
    const total = period.reduce((s, o) => s + (o.duration_minutes || 0), 0);
    const label = cmd === "/semana" ? "esta semana" : "este mes";
    await tg(env.BOT_TOKEN, chatId, `\u{1F4CA} *Resumen ${label}*

\u26A1 Cortes: *${period.length}*
\u23F1 Total sin luz: *${fmtDuration(total)}*
\u{1F50C} Fluctuaciones: *${flucs.length}*`);
    return;
  }
  if (cmd === "/probabilidad") {
    const active = await apiGet("/api/active", session);
    if (active) {
      await tg(env.BOT_TOKEN, chatId, `\u{1F62E}\u200D\u{1F4A8} Ya se fue la luz. Respira, lo m\xE1s probable es que no se vaya de nuevo hoy.

Usa /volvio cuando regrese.`);
      return;
    }
    const outages = await apiGet("/api/outages", session);
    if (!outages || outages.length < 3) {
      await tg(env.BOT_TOKEN, chatId, "\u2139\uFE0F Necesitas m\xE1s registros para calcular probabilidades.");
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const localNow = new Date(now.getTime() + TZ_OFFSET_HOURS * 36e5);
    const currentHour = localNow.getUTCHours();
    const risk = calculateDayRisk(outages, localNow);
    if (!risk) {
      await tg(env.BOT_TOKEN, chatId, "\u2705 Sin riesgo significativo hoy seg\xFAn tu historial.");
      return;
    }
    const inRisk = risk.risky.some((p) => p.h === currentHour);
    const prefix = inRisk ? "\u26A0\uFE0F *Est\xE1s en una hora de riesgo ahora mismo.*\n\n" : "";
    await tg(env.BOT_TOKEN, chatId, `${prefix}\u{1F52E} *Predicci\xF3n para hoy*

\u23F0 Riesgo: *${risk.rangeText}*
\u{1F4C8} Pico: *${String(risk.peak.h).padStart(2, "0")}:00* (${Math.round(risk.peak.prob * 100)}%${risk.marginOfError != null ? ` \xB1${risk.marginOfError}%` : ""})

_Basado en tu historial personal._`);
    return;
  }
  if (cmd === "/resetpass") {
    if (!session) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.notLinked);
      return;
    }
    const r = await fetch(`${API}/api/auth/reset-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `auth=${session}` }
    });
    if (!r.ok) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.error);
      return;
    }
    const { token } = await r.json();
    await tg(env.BOT_TOKEN, chatId, `\u{1F511} *Cambio de contrase\xF1a*

Abre este enlace (v\xE1lido 15 min):
${API}?reset=${token}

_No lo compartas con nadie._`);
    return;
  }
  if (cmd === "/renovar") {
    const refreshed = await refreshSession(env, userId, session);
    if (refreshed) {
      await tg(env.BOT_TOKEN, chatId, STRINGS.renewOk);
    } else {
      await tg(env.BOT_TOKEN, chatId, STRINGS.renewFail);
    }
    return;
  }
  await tg(env.BOT_TOKEN, chatId, STRINGS.unknown);
}
__name(handleUpdate, "handleUpdate");
function calculateDayRisk(outages, localNow) {
  const day = localNow.getUTCDay();
  const now = /* @__PURE__ */ new Date();
  const allDates = outages.filter((o) => o.start && o.end && (o.type || "corte") !== "fluctuacion").flatMap((o) => [new Date(o.start), new Date(o.end)]);
  if (!allDates.length) return null;
  const earliestDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const hardWindow = new Date(now);
  hardWindow.setDate(hardWindow.getDate() - 84);
  const windowStart = new Date(Math.max(earliestDate.getTime(), hardWindow.getTime()));
  const completed = outages.filter((o) => o.start && o.end && (o.type || "corte") !== "fluctuacion" && new Date(o.start) >= windowStart);
  const slots = {}, observations = {};
  const cur = new Date(windowStart);
  cur.setHours(0, 0, 0, 0);
  while (cur <= now) {
    for (let h = 0; h < 24; h++) {
      const localH = new Date(cur.getTime() + TZ_OFFSET_HOURS * 36e5 + h * 36e5);
      const k = `${localH.getUTCDay()}_${localH.getUTCHours()}`;
      observations[k] = (observations[k] || 0) + 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  completed.forEach((o) => {
    const s = new Date(o.start), e = new Date(o.end), c = new Date(s);
    c.setMinutes(0, 0, 0);
    while (c < e) {
      const localC = new Date(c.getTime() + TZ_OFFSET_HOURS * 36e5);
      const k = `${localC.getUTCDay()}_${localC.getUTCHours()}`;
      slots[k] = (slots[k] || 0) + 1;
      c.setHours(c.getHours() + 1);
    }
  });
  const rawProbability = /* @__PURE__ */ __name((h) => {
    const k = `${day}_${h}`;
    const obs = observations[k] || 0;
    const hits = slots[k] || 0;
    return obs > 0 ? (hits + 0.5) / (obs + 1) : 0;
  }, "rawProbability");
  const confidenceOf = /* @__PURE__ */ __name((h) => Math.min((observations[`${day}_${h}`] || 0) / WEEKS_FOR_FULL_CONFIDENCE, 1), "confidenceOf");
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
  const ranges = [];
  let rs = null, re = null;
  risky.forEach(({ h }) => {
    if (rs === null) {
      rs = h;
      re = h;
    } else if (h === re + 1) {
      re = h;
    } else {
      ranges.push([rs, re]);
      rs = h;
      re = h;
    }
  });
  if (rs !== null) ranges.push([rs, re]);
  const rangeText = ranges.map(
    ([a, b]) => a === b ? `${String(a).padStart(2, "0")}:00` : `${String(a).padStart(2, "0")}:00\u2013${String(b + 1).padStart(2, "0")}:00`
  ).join(", ");
  return { risky, peak, rangeText, marginOfError };
}
__name(calculateDayRisk, "calculateDayRisk");
function getConsecutiveOutageStatus(outages, now) {
  const completed = outages.filter((o) => o.start && o.end && (o.type || "corte") === "corte").map((o) => ({ start: new Date(o.start), end: new Date(o.end) })).sort((a, b) => a.start - b.start);
  if (!completed.length) return null;
  const gaps = [];
  for (let i = 1; i < completed.length; i++) {
    const hours = (completed[i].start - completed[i - 1].end) / 36e5;
    if (hours >= 0) gaps.push(hours);
  }
  if (gaps.length < CONSECUTIVE_OUTAGE_MIN_SAMPLE) return null;
  const lastEnd = completed[completed.length - 1].end;
  const hoursElapsed = (now - lastEnd) / 36e5;
  if (hoursElapsed < 0 || hoursElapsed > CONSECUTIVE_OUTAGE_MAX_ELAPSED_HOURS) return null;
  const eligible = gaps.filter((g) => g >= hoursElapsed);
  if (eligible.length < CONSECUTIVE_OUTAGE_MIN_SAMPLE) return null;
  const within = eligible.filter((g) => g <= hoursElapsed + CONSECUTIVE_OUTAGE_WINDOW_HOURS).length;
  const probability = (within + 0.5) / (eligible.length + 1);
  const percent = Math.round(probability * 100);
  const level = percent < 15 ? "bajo" : percent < 35 ? "moderado" : "alto";
  return { percent, level, hoursAhead: CONSECUTIVE_OUTAGE_WINDOW_HOURS, sampleSize: eligible.length };
}
__name(getConsecutiveOutageStatus, "getConsecutiveOutageStatus");
async function handleCron(env) {
  const now = Date.now();
  const localNow = new Date(now + TZ_OFFSET_HOURS * 36e5);
  const localHour = localNow.getUTCHours();
  const localMinute = localNow.getUTCMinutes();
  const today = localNow.toISOString().slice(0, 10);
  const activeR = await fetch(`${API}/api/active-sessions`, {
    headers: { "x-internal-secret": env.ADMIN_SECRET }
  });
  if (activeR.ok) {
    const sessions = await activeR.json();
    for (const row of sessions) {
      const { telegram_chat_id, start_time, outage_id } = row;
      if (!telegram_chat_id) continue;
      const elapsedMins = (now - new Date(start_time).getTime()) / 6e4;
      const reminderKey = `reminded:${telegram_chat_id}`;
      const stored = await env.KV.get(reminderKey);
      let sentSet = /* @__PURE__ */ new Set();
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.outageId === outage_id) sentSet = new Set(parsed.sent);
        } catch {
        }
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
    headers: { "x-internal-secret": env.ADMIN_SECRET }
  });
  if (!usersR.ok) return;
  const users = await usersR.json();
  for (const user of users) {
    const { telegram_chat_id, push_subscription } = user;
    let session = await env.KV.get(`session:${telegram_chat_id}`);
    if (!session) continue;
    const payload = decodeToken(session);
    if (payload && payload.exp) {
      const expIn = payload.exp - Math.floor(Date.now() / 1e3);
      if (expIn < 86400) {
        const refreshed = await refreshSession(env, telegram_chat_id, session);
        if (refreshed) {
          session = refreshed;
        } else if (expIn > 0) {
          const notified = await env.KV.get(`renew_notified:${telegram_chat_id}`);
          if (!notified) {
            await tgButtons(
              env.BOT_TOKEN,
              telegram_chat_id,
              `\u{1F511} Tu sesi\xF3n expira en menos de 24h. Usa el bot\xF3n para renovarla autom\xE1ticamente.`,
              [[{ text: "\u{1F504} Renovar sesi\xF3n", callback_data: "/renovar" }]]
            );
            await env.KV.put(`renew_notified:${telegram_chat_id}`, "1", { expirationTtl: 86400 });
          }
        }
      }
    }
    const closedToday = await env.KV.get(`closed_today:${telegram_chat_id}:${today}`);
    if (closedToday) continue;
    const outages = await apiGet("/api/outages", session);
    if (!outages || outages.length < 3) continue;
    const activeNow = await apiGet("/api/active", session);
    if (activeNow) continue;
    const startOfTodayUTC = /* @__PURE__ */ new Date(`${today}T${String(Math.abs(TZ_OFFSET_HOURS)).padStart(2, "0")}:00:00Z`);
    const hadOutageToday = outages.some(
      (o) => (o.type || "corte") === "corte" && new Date(o.start) >= startOfTodayUTC
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
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-secret": env.ADMIN_SECRET },
            body: JSON.stringify({ subscription: JSON.parse(push_subscription), title: pushTitle, body: pushBody })
          });
        } catch {
        }
      }
      await env.KV.put(key, "1", { expirationTtl: 86400 });
    }
    __name(sendAlert, "sendAlert");
    if (localHour === 9 && localMinute < 5) {
      await sendAlert(
        `${notifBase}:morning`,
        `\u{1F305} *Buenos d\xEDas*

Seg\xFAn tu historial, hoy hay riesgo entre las *${risk.rangeText}*
Pico: *${String(risk.peak.h).padStart(2, "0")}:00* (${Math.round(risk.peak.prob * 100)}%)

_Ojo pelao._`,
        "\u{1F305} Riesgo de corte hoy",
        `Seg\xFAn tu historial: ${risk.rangeText} \u2014 pico ${Math.round(risk.peak.prob * 100)}%`
      );
    }
    if (localHour === risk.peak.h - 1 && localMinute < 5) {
      await sendAlert(
        `${notifBase}:prehour`,
        `\u23F0 En 1 hora entra la hora pico (*${String(risk.peak.h).padStart(2, "0")}:00*) seg\xFAn tu historial. Por si las moscas.`,
        "\u23F0 Hora pico en 1 hora",
        `${String(risk.peak.h).padStart(2, "0")}:00 \u2014 ${Math.round(risk.peak.prob * 100)}% de probabilidad`
      );
    }
    if (localHour === risk.peak.h && localMinute < 5) {
      await sendAlert(
        `${notifBase}:peakhour`,
        `\u26A1 *Hora pico ahora* (${Math.round(risk.peak.prob * 100)}%)

Si se va, usa /corte para registrarlo.`,
        "\u26A1 Hora pico ahora",
        `${Math.round(risk.peak.prob * 100)}% de probabilidad. Si se va, registra el corte.`
      );
    }
  }
}
__name(handleCron, "handleCron");
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/invalidate" && req.method === "POST") {
      if (req.headers.get("x-internal-secret") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const { chat_id } = await req.json();
      await env.KV.delete(`session:${chat_id}`);
      await env.KV.delete(`pending_mood:${chat_id}`);
      await env.KV.delete(`reminded:${chat_id}`);
      return new Response("ok");
    }
    if (url.pathname === "/send-reset-link" && req.method === "POST") {
      if (req.headers.get("x-internal-secret") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const { chat_id, resetUrl, username } = await req.json();
      await tg(
        env.BOT_TOKEN,
        chat_id,
        `\u{1F511} *Cambio de contrase\xF1a*

El administrador ha iniciado un cambio de contrase\xF1a para @${username}.

Abre este enlace (v\xE1lido 15 min):
${resetUrl}

_No lo compartas con nadie._`
      );
      return new Response("ok");
    }
    if (req.method !== "POST") return new Response("ok");
    const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
    const update = await req.json();
    await handleUpdate(env, update);
    return new Response("ok");
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
