jest.mock('../_db');
jest.mock('../_auth');

const { mockSql } = require('../_db');
const { __setMockUser } = require('../_auth');
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
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      user: { id: '1', username: 'test', city: '', zone: '', is_public: true },
    });
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
    expect(res.json).toHaveBeenCalledWith(baseUser);
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

  it('returns ok when authenticated', async () => {
    __setMockUser({ id: '1', username: 'test' });
    const req = { method: 'POST', query: { action: 'telegram-unlink' }, body: {}, headers: {} };
    const res = mockRes();
    await handler(req, res);
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
