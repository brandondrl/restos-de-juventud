const bcrypt = require('bcryptjs');
const { getSql, initDb } = require('./_db');
const { requireAuth, signToken, setCookie, clearCookie } = require('./_auth');
const { badRequest, unauthorized, notFound, conflict, methodNotAllowed, log } = require('./_http');
const { isValidCity, isValidZone } = require('./_cities');

const authAttempts = new Map();

function getClientIp(req) {
  const forwarded = (req.headers || {})['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

function isRateLimited(key, limit = 10) {
  const now   = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= limit;
}

function incrementAttempts(key, windowMs = 900000) {
  const now   = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count++;
    authAttempts.set(key, entry);
  }
}

function clearAttempts(key) {
  authAttempts.delete(key);
}

function generateLinkToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = async (req, res) => {
  const sql = getSql();
  await initDb(sql);
  const action = req.query.action;

  if (action === 'login') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const { username, password } = req.body;
    if (!username || !password) return badRequest(res, 'Datos requeridos');
    const ip = getClientIp(req);
    if (isRateLimited(`login:${ip}`)) {
      log('warn', 'auth.rate_limited', { ip, action: 'login' });
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera 15 minutos.' });
    }
    const rows = await sql`SELECT * FROM users WHERE username = ${username.toLowerCase()}`;
    if (!rows.length) {
      incrementAttempts(`login:${ip}`);
      log('warn', 'auth.login.failed', { username: username.toLowerCase(), ip, reason: 'user_not_found' });
      return unauthorized(res, 'Usuario o contraseña incorrectos');
    }
    const user  = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      incrementAttempts(`login:${ip}`);
      log('warn', 'auth.login.failed', { username: username.toLowerCase(), ip, reason: 'wrong_password' });
      return unauthorized(res, 'Usuario o contraseña incorrectos');
    }
    clearAttempts(`login:${ip}`);
    log('info', 'auth.login.success', { username: user.username, ip });
    const token = signToken({ id: user.id, username: user.username });
    setCookie(res, token);
    return res.json({ ok: true, user: { id: user.id, username: user.username, city: user.city, zone: user.zone, is_public: user.is_public } });
  }

  if (action === 'logout') {
    clearCookie(res);
    return res.json({ ok: true });
  }

  if (action === 'me') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const rows = await sql`SELECT id, username, city, zone, is_public FROM users WHERE id = ${auth.id}`;
    if (!rows.length) return notFound(res, 'Usuario no encontrado');
    return res.json(rows[0]);
  }

  if (action === 'register') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const ip = getClientIp(req);
    if (isRateLimited(`register:${ip}`, 5)) {
      log('warn', 'auth.rate_limited', { ip, action: 'register' });
      return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }
    const { username, password, city = '', zone = '' } = req.body;
    if (!username || !password) return badRequest(res, 'Usuario y contraseña requeridos');
    if (username.length < 3)  return badRequest(res, 'El usuario debe tener al menos 3 caracteres');
    if (username.length > 30) return badRequest(res, 'El usuario no puede superar 30 caracteres');
    if (password.length < 6)  return badRequest(res, 'La contraseña debe tener al menos 6 caracteres');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return badRequest(res, 'Solo letras, números y guión bajo');
    if (!isValidCity(city))   return badRequest(res, 'Ciudad no válida');
    if (!isValidZone(zone))   return badRequest(res, 'Zona no válida');
    const exists = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()}`;
    if (exists.length) return conflict(res, 'Ese usuario ya existe');
    incrementAttempts(`register:${ip}`);
    const id            = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const password_hash = await bcrypt.hash(password, 10);
    await sql`INSERT INTO users (id, username, password_hash, city, zone) VALUES (${id}, ${username.toLowerCase()}, ${password_hash}, ${city}, ${zone})`;
    log('info', 'auth.register.success', { username: username.toLowerCase(), ip });
    const token = signToken({ id, username: username.toLowerCase() });
    setCookie(res, token);
    return res.json({ ok: true, user: { id, username: username.toLowerCase(), city, zone, is_public: true } });
  }

  if (action === 'telegram-token') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const user = requireAuth(req, res);
    if (!user) return;
    const token     = generateLinkToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await sql`UPDATE users SET telegram_link_token = ${token}, telegram_link_token_expires_at = ${expiresAt} WHERE id = ${user.id}`;
    return res.json({ token, expiresAt });
  }

  if (action === 'telegram-verify') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const { token, chat_id } = req.body;
    if (!token || !chat_id) return badRequest(res, 'Faltan datos');
    if (typeof token !== 'string') return badRequest(res, 'Token inválido');
    const ip   = getClientIp(req);
    const rows = await sql`
      SELECT * FROM users
      WHERE telegram_link_token = ${token.toUpperCase()}
      AND telegram_link_token_expires_at::timestamptz > NOW()
    `;
    if (!rows.length) {
      log('warn', 'auth.telegram_verify.failed', { ip, token: token.slice(0, 3) + '***' });
      return unauthorized(res, 'Código inválido o expirado');
    }
    const user = rows[0];
    await sql`
      UPDATE users
      SET telegram_chat_id = ${String(chat_id)},
          telegram_linked_at = NOW()::text,
          telegram_link_token = NULL,
          telegram_link_token_expires_at = NULL
      WHERE id = ${user.id}
    `;
    const jwt = signToken({ id: user.id, username: user.username });
    return res.json({ ok: true, token: jwt, username: user.username });
  }

  if (action === 'telegram-unlink') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const user = requireAuth(req, res);
    if (!user) return;
    await sql`UPDATE users SET telegram_chat_id = NULL, telegram_linked_at = NULL WHERE id = ${user.id}`;
    return res.json({ ok: true });
  }

  if (action === 'telegram-link') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const user = requireAuth(req, res);
    if (!user) return;
    const { chat_id } = req.body;
    if (!chat_id) return badRequest(res, 'chat_id requerido');
    await sql`UPDATE users SET telegram_chat_id = ${String(chat_id)}, telegram_linked_at = NOW()::text WHERE id = ${user.id}`;
    return res.json({ ok: true });
  }

  if (action === 'reset-token') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const user = requireAuth(req, res);
    if (!user) return;
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await sql`UPDATE users SET reset_token = ${token}, reset_token_expires_at = ${expiresAt} WHERE id = ${user.id}`;
    return res.json({ token });
  }

  if (action === 'reset-password') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const { token, password } = req.body;
    if (!token || !password) return badRequest(res, 'Datos requeridos');
    if (password.length < 6) return badRequest(res, 'Mínimo 6 caracteres');
    const rows = await sql`
      SELECT id FROM users
      WHERE reset_token = ${token}
      AND reset_token_expires_at::timestamptz > NOW()
    `;
    if (!rows.length) return badRequest(res, 'Token inválido o expirado');
    const hash = await bcrypt.hash(password, 10);
    await sql`UPDATE users SET password_hash = ${hash}, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ${rows[0].id}`;
    return res.json({ ok: true });
  }

  notFound(res, 'Acción no encontrada');
};
