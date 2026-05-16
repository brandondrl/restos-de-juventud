const { neon } = require('@neondatabase/serverless');

function getSql() {
  return neon(process.env.DATABASE_URL);
}

async function initDb(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS outages (
      id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL,
      notes TEXT,
      created_at TEXT DEFAULT NOW()::text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS active_outage (
      singleton TEXT PRIMARY KEY DEFAULT 'current',
      outage_id TEXT,
      start_time TEXT
    )
  `;
}

module.exports = { getSql, initDb };
