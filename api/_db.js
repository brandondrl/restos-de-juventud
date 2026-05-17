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
      type TEXT DEFAULT 'corte',
      notes TEXT,
      created_at TEXT DEFAULT NOW()::text
    )
  `;
  // Migration: add type column for existing deployments
  await sql`
    ALTER TABLE outages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'corte'
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
