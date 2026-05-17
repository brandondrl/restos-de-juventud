const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function getUser(req) {
  try {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/auth=([^;]+)/);
    if (!match) return null;
    return jwt.verify(match[1], SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: 'No autorizado' }); return null; }
  return user;
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

function setCookie(res, token) {
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `auth=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`);
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'auth=; HttpOnly; Path=/; Max-Age=0');
}

module.exports = { getUser, requireAuth, signToken, setCookie, clearCookie };
