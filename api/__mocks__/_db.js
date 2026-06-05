const mockSql = jest.fn();
const initDb = jest.fn().mockResolvedValue(undefined);

function getSql() {
  return mockSql;
}

module.exports = { getSql, initDb, mockSql };
