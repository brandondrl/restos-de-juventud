jest.mock('../_db');
jest.mock('../_auth');

const { mockSql } = require('../_db');
const { __setMockUser } = require('../_auth');
const bcrypt = require('bcryptjs');
const handler = require('../profile');

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
    const req = { method: 'GET', body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 if profile not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'GET', body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns profile with stats and has_telegram', async () => {
    const profileRow = { id: 'user1', username: 'test', city: 'Cabudare', zone: 'Norte', is_public: true, created_at: 'now', telegram_chat_id: '123', has_telegram: true };
    const statsRow = { total_cortes: 5, total_mins: 300, total_flucs: 2 };
    mockSql.mockResolvedValueOnce([profileRow]);
    mockSql.mockResolvedValueOnce([statsRow]);
    const req = { method: 'GET', body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ...profileRow, stats: statsRow });
  });
});

describe('PUT', () => {
  it('returns 401 if not authenticated', async () => {
    __setMockUser(null);
    const req = { method: 'PUT', body: { city: 'Cabudare' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 if is_public is not boolean', async () => {
    const req = { method: 'PUT', body: { is_public: 'yes' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if city is not a string', async () => {
    const req = { method: 'PUT', body: { city: 123 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if zone is not a string', async () => {
    const req = { method: 'PUT', body: { zone: 123 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 if city is not in the whitelist', async () => {
    const req = { method: 'PUT', body: { city: 'Mordor' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ciudad no válida' });
  });

  it('returns 400 if zone is not in the whitelist', async () => {
    const req = { method: 'PUT', body: { zone: 'Inexistente' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ error: 'Zona no válida' });
  });

  it('updates city, zone and visibility', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'PUT', body: { city: 'Cabudare', zone: 'Norte', is_public: false } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 400 if newPassword given without currentPassword', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'PUT', body: { newPassword: 'newpass123' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña actual requerida' });
  });

  it('returns 400 if newPassword is too short', async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'PUT', body: { currentPassword: 'oldpass', newPassword: '123' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ error: 'Mínimo 6 caracteres' });
  });

  it('returns 400 if current password is incorrect', async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ password_hash: 'hash' }]);
    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);
    const req = { method: 'PUT', body: { currentPassword: 'wrong', newPassword: 'newpass123' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña actual incorrecta' });
  });

  it('changes password when current password is valid', async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ password_hash: 'hash' }]);
    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('newhash');
    mockSql.mockResolvedValueOnce([]);
    const req = { method: 'PUT', body: { currentPassword: 'oldpass', newPassword: 'newpass123' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('method not allowed', () => {
  it('returns 405 for unsupported methods', async () => {
    const req = { method: 'DELETE', body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});