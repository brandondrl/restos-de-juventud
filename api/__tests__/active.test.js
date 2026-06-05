jest.mock('../_db');
jest.mock('../_auth');

const { mockSql } = require('../_db');
const { __setMockUser } = require('../_auth');
const handler = require('../active');

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
});

describe('GET', () => {
  it('returns 401 if not authenticated', async () => {
    __setMockUser(null);
    const req = { method: 'GET', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns active outage when exists', async () => {
    mockSql.mockResolvedValueOnce([{ outage_id: 'abc', start_time: '2024-01-01' }]);
    const req = { method: 'GET', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ id: 'abc', start: '2024-01-01' });
  });

  it('returns null when no active outage', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'GET', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(null);
  });
});

describe('POST', () => {
  it('returns 400 if id missing', async () => {
    const req = { method: 'POST', query: {}, body: { start: '2024-01-01' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if start missing', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if id is not string', async () => {
    const req = { method: 'POST', query: {}, body: { id: 123, start: '2024-01-01' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if start is invalid date', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: 'bad-date' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns ok on valid POST', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('DELETE', () => {
  it('returns ok', async () => {
    const req = { method: 'DELETE', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('method not allowed', () => {
  it('returns 405 for PATCH', async () => {
    const req = { method: 'PATCH', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
