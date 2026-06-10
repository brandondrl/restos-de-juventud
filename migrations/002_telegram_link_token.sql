ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_token_expires_at TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_telegram_link_token ON users(telegram_link_token) WHERE telegram_link_token IS NOT NULL
