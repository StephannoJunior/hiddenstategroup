-- Artists, records and mixes, editable from the console.
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-content.sql
--
-- All CREATE TABLE IF NOT EXISTS, so this is safe to run any number of times.

CREATE TABLE IF NOT EXISTS artists (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  alias      TEXT,
  type       TEXT DEFAULT 'DJ',
  genres     TEXT,                        -- JSON array
  country    TEXT,
  location   TEXT,
  descr      TEXT,                        -- the one-line version on the roster
  bio        TEXT,
  photo      TEXT,
  poster     TEXT,
  instagram  TEXT,                        -- the key from social.js
  sort_order INTEGER DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS records (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  artist       TEXT,
  kind         TEXT DEFAULT 'ALBUM',      -- ALBUM | EP | SINGLE
  tagline      TEXT,
  catalog      TEXT,
  release_date TEXT,
  cover        TEXT,
  playlist     TEXT,
  note         TEXT,
  tracks       TEXT,                      -- JSON array
  sort_order   INTEGER DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS mixes (
  slug             TEXT PRIMARY KEY,
  artist_id        INTEGER,
  name             TEXT NOT NULL,
  alias            TEXT,
  photo            TEXT,
  genres           TEXT,                  -- JSON array
  intro            TEXT,
  coming_soon      INTEGER NOT NULL DEFAULT 0,
  coming_soon_note TEXT,
  sections         TEXT,                  -- JSON array of { label, items }
  sort_order       INTEGER DEFAULT 0,
  published        INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT
);
