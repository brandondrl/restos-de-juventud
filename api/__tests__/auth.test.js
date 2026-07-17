jest.mock('../_db');
jest.mock('../_auth');
jest.mock('../_config');

const { mockSql } = require('../_db');
const { __setMockUser } = require('../_auth');
const config = require('../_config');
const bcrypt  = require('bcryptjs');
const handler = require('../auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.end    = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

const baseUser = { id: '1', username: 'test', city: '', zone: '', is_public: true, created_at: 'now' };

beforeEach(() => {
  jest.clearAllMocks();
  __setMockUser(null);
  config.BOT_URL = null;
  config.WEBHOOK_SECRET = null;
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

describe('login', () => {
  it('returns 400 if username missing', async () => {
    const req = { method: 'POST', query: { action: 'login' }, body: { password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Datos requeridos' });
  });

  it('returns 400 if password missing', async () => {
    const req = { method: 'POST', query: { action: 'login' }, body: { username: 'test' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 405 if not POST', async () => {
    const req = { method: 'GET', query: { action: 'login' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 401 if user not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'login' }, body: { username: 'x', password: '123456' }, headers: { 'x-forwarded-for': '1.0.0.1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 if password wrong', async () => {
    mockSql.mockResolvedValueOnce([{ ...baseUser, password_hash: 'hash' }]);
    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);
    const req = { method: 'POST', query: { action: 'login' }, body: { username: 'test', password: 'wrong' }, headers: { 'x-forwarded-for': '1.0.0.2' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns ok and sets cookie on valid login', async () => {
    mockSql.mockResolvedValueOnce([{ ...baseUser, password_hash: 'hash' }]);
    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);
    const req = { method: 'POST', query: { action: 'login' }, body: { username: 'test', password: 'correct' }, headers: { 'x-forwarded-for': '1.0.0.3' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      user: { id: '1', username: 'test', city: '', zone: '', is_public: true },
    }));
    expect(res.setHeader).toHaveBeenCalled();
  });
});

describe('rate limiting', () => {
  it('returns 429 after 10 failed login attempts from same IP', async () => {
    const ip = '99.99.99.1';
    for (let i = 0; i < 10; i++) {
      mockSql.mockResolvedValueOnce([]);
      const req = { method: 'POST', query: { action: 'login' }, body: { username: 'u', password: 'p' }, headers: { 'x-forwarded-for': ip } };
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    }
    const req = { method: 'POST', query: { action: 'login' }, body: { username: 'u', password: 'p' }, headers: { 'x-forwarded-for': ip } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('returns 429 after 5 successful registrations from same IP', async () => {
    const ip = '99.99.99.2';
    for (let i = 0; i < 5; i++) {
      mockSql.mockResolvedValueOnce([]);
      jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed');
      const req = { method: 'POST', query: { action: 'register' }, body: { username: `usr${i}xx`, password: '123456' }, headers: { 'x-forwarded-for': ip } };
      const res = mockRes();
      await handler(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    }
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'blocked', password: '123456' }, headers: { 'x-forwarded-for': ip } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('register', () => {
  it('returns 400 if username missing', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if username too short', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'ab', password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if password too short', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'valid', password: '12345' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if username has invalid chars', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'user name!', password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if city too long', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'valid', password: '123456', city: 'a'.repeat(61) }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 if username taken', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'existing', password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns ok and creates user', async () => {
    mockSql.mockResolvedValueOnce([]);
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed');
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'newuser', password: '123456' }, headers: { 'x-forwarded-for': '2.0.0.1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

describe('me', () => {
  it('returns 401 if not authenticated', async () => {
    const req = { method: 'GET', query: { action: 'me' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 if user not in db', async () => {
    __setMockUser({ id: '1', username: 'test' });
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'GET', query: { action: 'me' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns user data when authenticated', async () => {
    __setMockUser({ id: '1', username: 'test' });
    mockSql.mockResolvedValueOnce([baseUser]);
    const req = { method: 'GET', query: { action: 'me' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining(baseUser));
  });
});

describe('telegram-token', () => {
  it('returns 401 if not authenticated', async () => {
    const req = { method: 'POST', query: { action: 'telegram-token' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 if not POST', async () => {
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'GET', query: { action: 'telegram-token' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns token and expiry on success', async () => {
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'POST', query: { action: 'telegram-token' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: expect.any(String), expiresAt: expect.any(String) })
    );
  });
});

describe('telegram-verify', () => {
  it('returns 400 if token missing', async () => {
    const req = { method: 'POST', query: { action: 'telegram-verify' }, body: { chat_id: '123' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if token is not string', async () => {
    const req = { method: 'POST', query: { action: 'telegram-verify' }, body: { token: 123, chat_id: '456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 if token invalid or expired', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'telegram-verify' }, body: { token: 'BADTKN', chat_id: '123' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns ok on valid token', async () => {
    mockSql.mockResolvedValueOnce([{ ...baseUser }]);
    const req = { method: 'POST', query: { action: 'telegram-verify' }, body: { token: 'ABC123', chat_id: '123' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

describe('telegram-unlink', () => {
  it('returns 401 if not authenticated', async () => {
    const req = { method: 'POST', query: { action: 'telegram-unlink' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns ok when authenticated without telegram', async () => {
    mockSql.mockResolvedValueOnce([{ telegram_chat_id: null }]);
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'POST', query: { action: 'telegram-unlink' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('invalidates bot session when telegram linked and bot configured', async () => {
    config.BOT_URL = 'https://restos-bot.brandondrl.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    mockSql.mockResolvedValueOnce([{ telegram_chat_id: '999' }]);
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'POST', query: { action: 'telegram-unlink' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://restos-bot.brandondrl.workers.dev/invalidate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-internal-secret': 'webhook-secret' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('skips bot invalidation when bot is not configured', async () => {
    mockSql.mockResolvedValueOnce([{ telegram_chat_id: '999' }]);
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'POST', query: { action: 'telegram-unlink' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('telegram-link', () => {
  it('returns 401 if not authenticated', async () => {
    const req = { method: 'POST', query: { action: 'telegram-link' }, body: { chat_id: '123' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 if chat_id missing', async () => {
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'POST', query: { action: 'telegram-link' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns ok when authenticated', async () => {
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'POST', query: { action: 'telegram-link' }, body: { chat_id: '123' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('admin-reset-password', () => {
  beforeEach(() => {
    config.BOT_URL = null;
    config.WEBHOOK_SECRET = null;
  });

  it('returns 401 if not authenticated', async () => {
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: { userId: 'target1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 if not POST', async () => {
    __setMockUser({ id: 'admin1', username: 'brandon' });
    const req = { method: 'GET', query: { action: 'admin-reset-password' }, body: { userId: 'target1' }, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 403 if not admin', async () => {
    __setMockUser({ id: 'user1', username: 'test' });
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: { userId: 'target1' }, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 if userId missing', async () => {
    __setMockUser({ id: 'admin1', username: 'brandon' });
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: {}, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'ID de usuario requerido' });
  });

  it('returns 404 if target user not found', async () => {
    __setMockUser({ id: 'admin1', username: 'brandon' });
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: { userId: 'nonexistent' }, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });

  it('returns resetUrl and token on success without telegram', async () => {
    __setMockUser({ id: 'admin1', username: 'brandon' });
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: null }]);
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: { userId: 'target1' }, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      resetUrl: expect.stringMatching(/^https:\/\/test\.vercel\.app\?reset=[A-Z2-9]{8}$/),
      sentViaTelegram: false,
      username: 'fulano',
    });
  });

  it('sends via telegram when user has chat_id and bot configured', async () => {
    __setMockUser({ id: 'admin1', username: 'brandon' });
    config.BOT_URL = 'https://restos-bot.test.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: '12345' }]);
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: { userId: 'target1' }, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://restos-bot.test.workers.dev/send-reset-link',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-internal-secret': 'webhook-secret' }),
        body: expect.stringContaining('12345'),
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      sentViaTelegram: true,
      username: 'fulano',
    }));
  });

  it('does not send via telegram when user has no chat_id even if bot configured', async () => {
    __setMockUser({ id: 'admin1', username: 'brandon' });
    config.BOT_URL = 'https://restos-bot.test.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: null }]);
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: { userId: 'target1' }, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      sentViaTelegram: false,
    }));
  });

  it('gracefully handles telegram send failure', async () => {
    __setMockUser({ id: 'admin1', username: 'brandon' });
    config.BOT_URL = 'https://restos-bot.test.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: '12345' }]);
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'admin-reset-password' }, body: { userId: 'target1' }, headers: { host: 'test.vercel.app' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      sentViaTelegram: false,
    }));
  });
});

describe('unknown action', () => {
  it('returns 404', async () => {
    const req = { method: 'GET', query: { action: 'unknown' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('logout', () => {
  it('clears cookie and returns ok', async () => {
    const req = { method: 'GET', query: { action: 'logout' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', 'auth=; HttpOnly; Path=/; Max-Age=0');
  });
});

describe('city and zone validation', () => {
  it('returns 400 if city is not in the allowed list', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'valid', password: '123456', city: 'Mordor' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ciudad no válida' });
  });

  it('returns 400 if zone is not in the allowed list', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'valid', password: '123456', zone: 'Universo' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Zona no válida' });
  });

  it('allows empty city on register', async () => {
    mockSql.mockResolvedValueOnce([]);
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed');
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'nocity', password: '123456', city: '' }, headers: { 'x-forwarded-for': '3.0.0.1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('allows valid city from the list on register', async () => {
    mockSql.mockResolvedValueOnce([]);
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed');
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'cabudare', password: '123456', city: 'Cabudare' }, headers: { 'x-forwarded-for': '3.0.0.2' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('blocks SQL injection attempt in city field', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'valid', password: '123456', city: "'; DROP TABLE users;--" }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks XSS attempt in city field', async () => {
    const req = { method: 'POST', query: { action: 'register' }, body: { username: 'valid', password: '123456', city: '<script>alert(1)</script>' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('reset-token', () => {
  it('returns 401 if not authenticated', async () => {
    const req = { method: 'POST', query: { action: 'reset-token' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 if not POST', async () => {
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'GET', query: { action: 'reset-token' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns a token on success', async () => {
    __setMockUser({ id: '1', username: 'test' });
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'reset-token' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ token: expect.any(String) });
  });
});

describe('reset-password', () => {
  it('returns 400 if token missing', async () => {
    const req = { method: 'POST', query: { action: 'reset-password' }, body: { password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if password missing', async () => {
    const req = { method: 'POST', query: { action: 'reset-password' }, body: { token: 'ABCD1234' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if password too short', async () => {
    const req = { method: 'POST', query: { action: 'reset-password' }, body: { token: 'ABCD1234', password: '123' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if token is invalid or expired', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'reset-password' }, body: { token: 'BADTOKEN', password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado' });
  });

  it('returns ok on a valid token', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('newhash');
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', query: { action: 'reset-password' }, body: { token: 'GOODTOKEN', password: '123456' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});