jest.mock('../_db');
jest.mock('../_auth');
jest.mock('../_config');

const { mockSql } = require('../_db');
const { __setMockUser } = require('../_auth');
const config = require('../_config');
const handler = require('../account');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  __setMockUser({ id: 'user1', username: 'test' });
  config.BOT_URL = null;
  config.WEBHOOK_SECRET = null;
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

describe('method not allowed', () => {
  it('returns 405 for non-DELETE methods', async () => {
    const req = { method: 'GET', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe('DELETE', () => {
  it('returns 401 if not authenticated', async () => {
    __setMockUser(null);
    const req = { method: 'DELETE', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('deletes account without telegram linked', async () => {
    mockSql.mockResolvedValueOnce([{ telegram_chat_id: null }]);
    const req = { method: 'DELETE', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('invalidates bot session when telegram linked and bot configured', async () => {
    config.BOT_URL = 'https://restos-bot.brandondrl.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    mockSql.mockResolvedValueOnce([{ telegram_chat_id: '999' }]);
    const req = { method: 'DELETE', headers: {} };
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
    const req = { method: 'DELETE', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('still returns ok if bot invalidation fails', async () => {
    config.BOT_URL = 'https://restos-bot.brandondrl.workers.dev';
    config.WEBHOOK_SECRET = 'webhook-secret';
    mockSql.mockResolvedValueOnce([{ telegram_chat_id: '999' }]);
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const req = { method: 'DELETE', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('clears auth cookie', async () => {
    mockSql.mockResolvedValueOnce([{ telegram_chat_id: null }]);
    const req = { method: 'DELETE', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Max-Age=0'));
  });
});