CREATE TABLE IF NOT EXISTS rate_limit_counters (
 key TEXT PRIMARY KEY,
 hits INTEGER NOT NULL,
 expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_expiry ON rate_limit_counters(expires_at);
