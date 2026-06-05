jest.mock('../_db');
jest.mock('../_auth');

const { mockSql } = require('../_db');
const { __setMockUser } = require('../_auth');
const handler = require('../outages');

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

  it('returns list of outages', async () => {
    const rows = [
      { id: '1', start_time: '2024-01-01', end_time: '2024-01-02', duration_minutes: 120, type: 'corte', mood: 3, notes: 'test' },
    ];
    mockSql.mockResolvedValueOnce(rows);
    const req = { method: 'GET', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith([
      { id: '1', start: '2024-01-01', end: '2024-01-02', duration_minutes: 120, type: 'corte', mood: 3, notes: 'test' },
    ]);
  });

  it('returns empty array when no outages', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'GET', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
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
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: 'not-a-date' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if end is invalid date', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01', end: 'bad-date' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if duration_minutes is negative', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01', duration_minutes: -1 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if duration_minutes is not a number', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01', duration_minutes: 'text' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if type is invalid', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01', type: 'invalid' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if mood out of range (above 5)', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01', mood: 6 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if mood out of range (below 1)', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01', mood: 0 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if mood is not integer', async () => {
    const req = { method: 'POST', query: {}, body: { id: 'abc', start: '2024-01-01', mood: 1.5 } };
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

  it('accepts optional fields', async () => {
    const req = {
      method: 'POST', query: {}, body: {
        id: 'abc', start: '2024-01-01', end: '2024-01-02',
        duration_minutes: 120, type: 'fluctuacion', mood: 5, notes: 'ok',
      },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('DELETE', () => {
  it('returns 400 if id missing', async () => {
    const req = { method: 'DELETE', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns ok on valid DELETE', async () => {
    const req = { method: 'DELETE', query: { id: 'abc' }, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('method not allowed', () => {
  it('returns 405 for unsupported methods', async () => {
    const req = { method: 'PATCH', query: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
