jest.mock('../_db');
jest.mock('../_auth');
jest.mock('web-push');

const { __setMockUser } = require('../_auth');
const webpush = require('web-push');
const handler = require('../push');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  __setMockUser({ id: 'user1', username: 'test' });
  process.env = { ...ORIGINAL_ENV, ADMIN_SECRET: 'default-admin-secret' };
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('POST subscription (usuario autenticado)', () => {
  it('returns 401 if not authenticated', async () => {
    __setMockUser(null);
    const req = { method: 'POST', headers: {}, body: { subscription: { endpoint: 'x' } } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 if subscription is missing', async () => {
    const req = { method: 'POST', headers: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if subscription is not an object', async () => {
    const req = { method: 'POST', headers: {}, body: { subscription: 'not-an-object' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('saves the subscription on a valid POST', async () => {
    const req = { method: 'POST', headers: {}, body: { subscription: { endpoint: 'https://fcm.example/x' } } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('DELETE subscription', () => {
  it('returns 401 if not authenticated', async () => {
    __setMockUser(null);
    const req = { method: 'DELETE', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('clears the subscription', async () => {
    const req = { method: 'DELETE', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('POST envío interno (x-internal-secret)', () => {
  it('returns 500 if VAPID is not configured', async () => {
    const req = { method: 'POST', headers: { 'x-internal-secret': 'default-admin-secret' }, body: { subscription: { endpoint: 'x' }, title: 't', body: 'b' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 400 if subscription is missing', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    const req = { method: 'POST', headers: { 'x-internal-secret': 'default-admin-secret' }, body: { title: 't', body: 'b' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sends the notification successfully', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    webpush.sendNotification.mockResolvedValueOnce({});
    const req = { method: 'POST', headers: { 'x-internal-secret': 'default-admin-secret' }, body: { subscription: { endpoint: 'x' }, title: 't', body: 'b' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('clears the subscription and forwards the status on 410 Gone', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    webpush.sendNotification.mockRejectedValueOnce({ statusCode: 410, message: 'Gone' });
    const req = { method: 'POST', headers: { 'x-internal-secret': 'default-admin-secret' }, body: { subscription: { endpoint: 'x' }, title: 't', body: 'b' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(410);
  });
});

describe('method not allowed', () => {
  it('returns 405 for unsupported methods', async () => {
    const req = { method: 'PATCH', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});