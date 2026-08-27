-- Settings, and per-account permissions.
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-4.sql
--
-- Each statement is separate so one "duplicate column" does not stop the rest.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);
