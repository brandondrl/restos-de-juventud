CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  city TEXT DEFAULT '',
  zone TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT NOW()::text
);

CREATE TABLE IF NOT EXISTS outages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_minutes REAL,
  type TEXT DEFAULT 'corte',
  mood INTEGER DEFAULT NULL,
  notes TEXT,
  created_at TEXT DEFAULT NOW()::text
);

CREATE TABLE IF NOT EXISTS active_outage_v2 (
  user_id TEXT PRIMARY KEY,
  outage_id TEXT,
  start_time TEXT
);
