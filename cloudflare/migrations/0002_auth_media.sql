-- D1 extension for independent Cloudflare login and staging images.
ALTER TABLE admins ADD COLUMN password_hash TEXT;
ALTER TABLE admins ADD COLUMN password_salt TEXT;
ALTER TABLE admins ADD COLUMN updated_at TEXT;
ALTER TABLE events ADD COLUMN created_by TEXT;
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_invites (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, used_at TEXT);
CREATE TABLE IF NOT EXISTS login_attempts (identifier TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS media (path TEXT PRIMARY KEY, mime TEXT NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
