-- New tables only. Every one is CREATE TABLE IF NOT EXISTS, so this file can
-- be run any number of times and can never fail on something already there.
--
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-tables.sql

CREATE TABLE IF NOT EXISTS login_attempts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ip       TEXT NOT NULL,
  username TEXT,
  ok       INTEGER NOT NULL,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_ip ON login_attempts(ip, at);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  slug        TEXT PRIMARY KEY,
  headline    TEXT NOT NULL,
  summary     TEXT,
  body        TEXT,
  kicker      TEXT,
  signoff     TEXT,
  category    TEXT NOT NULL DEFAULT 'NEWS',
  categories  TEXT,
  issue       TEXT,
  date_label  TEXT,
  sort_date   TEXT,
  poster      TEXT,
  photo       TEXT,
  caption     TEXT,
  link        TEXT,
  link_label  TEXT,
  published   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT,
  author      TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_sort ON posts(sort_date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pub  ON posts(published);
