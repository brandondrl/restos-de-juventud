const bcrypt = require('bcryptjs');
const { getSql, initDb } = require('./_db');
const { getUser, requireAuth, signToken, setCookie, clearCookie } = require('./_auth');
const { badRequest, unauthorized, notFound, conflict, methodNotAllowed } = require('./_http');

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
    const rows = await sql`SELECT * FROM users WHERE username = ${username.toLowerCase()}`;
    if (!rows.length) return unauthorized(res, 'Usuario o contraseña incorrectos');
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return unauthorized(res, 'Usuario o contraseña incorrectos');
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
    const { username, password, city = '', zone = '' } = req.body;
    if (!username || !password) return badRequest(res, 'Usuario y contraseña requeridos');
    if (username.length < 3) return badRequest(res, 'El usuario debe tener al menos 3 caracteres');
    if (password.length < 6) return badRequest(res, 'La contraseña debe tener al menos 6 caracteres');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return badRequest(res, 'Solo letras, números y guión bajo');
    const exists = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()}`;
    if (exists.length) return conflict(res, 'Ese usuario ya existe');
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const password_hash = await bcrypt.hash(password, 10);
    await sql`INSERT INTO users (id, username, password_hash, city, zone) VALUES (${id}, ${username.toLowerCase()}, ${password_hash}, ${city}, ${zone})`;
    const token = signToken({ id, username: username.toLowerCase() });
    setCookie(res, token);
    return res.json({ ok: true, user: { id, username: username.toLowerCase(), city, zone, is_public: true } });
  }

  if (action === 'telegram-token') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const user = requireAuth(req, res);
    if (!user) return;
    const token = generateLinkToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await sql`
      UPDATE users
      SET telegram_link_token = ${token}, telegram_link_token_expires_at = ${expiresAt}
      WHERE id = ${user.id}
    `;
    return res.json({ token, expiresAt });
  }

  if (action === 'telegram-verify') {
    if (req.method !== 'POST') return methodNotAllowed(res);
    const { token, chat_id } = req.body;
    if (!token || !chat_id) return badRequest(res, 'Faltan datos');
    if (typeof token !== 'string') return badRequest(res, 'Token inválido');
    const rows = await sql`
      SELECT * FROM users
      WHERE telegram_link_token = ${token.toUpperCase()}
      AND telegram_link_token_expires_at::timestamptz > NOW()
    `;
    if (!rows.length) return unauthorized(res, 'Código inválido o expirado');
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
    await sql`
      UPDATE users
      SET telegram_chat_id = NULL, telegram_linked_at = NULL
      WHERE id = ${user.id}
    `;
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

  notFound(res, 'Acción no encontrada');
};
