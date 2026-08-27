-- Capacity, admit counts, and login attempt tracking.
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-2.sql
--
-- "duplicate column" errors mean that part already ran and can be ignored.
ALTER TABLE parties ADD COLUMN capacity INTEGER;
ALTER TABLE passes ADD COLUMN admits INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS login_attempts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ip       TEXT NOT NULL,
  username TEXT,
  ok       INTEGER NOT NULL,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_ip ON login_attempts(ip, at);
