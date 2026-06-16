ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_push_subscription ON users(id) WHERE push_subscription IS NOT NULL
