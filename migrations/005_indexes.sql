CREATE INDEX IF NOT EXISTS idx_outages_user_id ON outages(user_id);
CREATE INDEX IF NOT EXISTS idx_outages_type ON outages(type);
CREATE INDEX IF NOT EXISTS idx_outages_start_time ON outages(start_time);
CREATE INDEX IF NOT EXISTS idx_outages_user_type_start ON outages(user_id, type, start_time);
CREATE INDEX IF NOT EXISTS idx_users_is_public ON users(is_public);
