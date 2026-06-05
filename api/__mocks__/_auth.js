let mockUser = null;

function __setMockUser(user) {
  mockUser = user;
}

function getUser() {
  return mockUser;
}

function requireAuth(req, res) {
  if (!mockUser) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }
  return mockUser;
}

function signToken(payload) {
  return 'mock-token-' + payload.id;
}

function setCookie(res, token) {
  res.setHeader('Set-Cookie', 'auth=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=259200');
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'auth=; HttpOnly; Path=/; Max-Age=0');
}

module.exports = { getUser, requireAuth, signToken, setCookie, clearCookie, __setMockUser };
