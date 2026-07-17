jest.mock('../_db');
jest.mock('../_auth');
jest.mock('../_config');

const { mockSql } = require('../_db');
const { __setMockUser } = require('../_auth');
const config = require('../_config');
const handler = require('../admin');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.end    = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.send = jest.fn();
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  __setMockUser({ id: 'admin1', username: 'brandon' });
  config.BOT_URL = null;
  config.WEBHOOK_SECRET = null;
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

describe('GET', () => {
  it('returns 200 with HTML content', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'GET', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Panel de administración'));
  });

  it('returns 401 if not authenticated', async () => {
    __setMockUser(null);
    const req = { method: 'GET', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 if not brandon', async () => {
    __setMockUser({ id: 'user1', username: 'test' });
    const req = { method: 'GET', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('POST admin-delete-account', () => {
  it('returns 401 if not authenticated', async () => {
    __setMockUser(null);
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'target1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 if not brandon', async () => {
    __setMockUser({ id: 'user1', username: 'test' });
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'target1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 if userId missing', async () => {
    const req = { method: 'POST', body: { action: 'delete-account' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 if target user not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'nonexistent' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 if trying to delete brandon', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'admin1', username: 'brandon', telegram_chat_id: null }]);
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'admin1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('deletes user data and returns ok without telegram', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: null }]);
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'target1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, username: 'fulano' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('invalidates bot session when telegram linked and bot configured', async () => {
    config.BOT_URL = 'https://restos-bot.test.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: '999' }]);
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'target1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://restos-bot.test.workers.dev/invalidate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-internal-secret': 'webhook-secret' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, username: 'fulano' });
  });

  it('still returns ok if bot invalidation fails', async () => {
    config.BOT_URL = 'https://restos-bot.test.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: '999' }]);
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'target1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, username: 'fulano' });
  });

  it('skips bot invalidation when bot not configured', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'target1', username: 'fulano', telegram_chat_id: '999' }]);
    const req = { method: 'POST', body: { action: 'delete-account', userId: 'target1' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, username: 'fulano' });
  });
});
