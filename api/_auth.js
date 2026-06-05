const jwt = require('jsonwebtoken');
const { unauthorized } = require('./_http');
const config = require('./_config');

function getSecret() {
  if (!config.JWT_SECRET) {
    console.error('[Config] JWT_SECRET no configurado');
    throw new Error('Error de configuración del servidor. Contacta con el administrador.');
  }
  return config.JWT_SECRET;
}

function getUser(req) {
  try {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/auth=([^;]+)/);
    if (!match) return null;
    return jwt.verify(match[1], getSecret());
  } catch {
    return null;
  }
}

function requireAuth(req, res) {
  const user = getUser(req);
  if (!user) { unauthorized(res); return null; }
  return user;
}

function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '72h' });
}

function setCookie(res, token) {
  const secure = config.VERCEL_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `auth=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=259200${secure}`);
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'auth=; HttpOnly; Path=/; Max-Age=0');
}

module.exports = { getUser, requireAuth, signToken, setCookie, clearCookie };
