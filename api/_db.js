const { neon } = require('@neondatabase/serverless');

function getSql() {
  return neon(process.env.DATABASE_URL);
}

async function initDb(sql) {
  await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, city TEXT DEFAULT '', zone TEXT DEFAULT '', is_public BOOLEAN DEFAULT true, created_at TEXT DEFAULT NOW()::text)`;
  await sql`CREATE TABLE IF NOT EXISTS outages (id TEXT PRIMARY KEY, user_id TEXT, start_time TEXT NOT NULL, end_time TEXT, duration_minutes REAL, type TEXT DEFAULT 'corte', mood INTEGER DEFAULT NULL, notes TEXT, created_at TEXT DEFAULT NOW()::text)`;
  await sql`ALTER TABLE outages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'corte'`;
  await sql`ALTER TABLE outages ADD COLUMN IF NOT EXISTS user_id TEXT`;
  await sql`ALTER TABLE outages ADD COLUMN IF NOT EXISTS mood INTEGER DEFAULT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS active_outage_v2 (user_id TEXT PRIMARY KEY, outage_id TEXT, start_time TEXT)`;
}

module.exports = { getSql, initDb };
