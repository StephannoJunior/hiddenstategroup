-- ─── THE SONG POOL ─────────────────────────────────────────────────────────
-- Two kinds of pool, one table:
--
--   EVENT   what people want to hear at a particular night. Tied to a party,
--           and it empties out of the public view once that night has passed.
--   HOUSE   the standing list. Not tied to anything, always open, and the one
--           you build yourself between events.
--
-- A link is stored exactly as it was pasted, because that is the only thing
-- the person actually gave us and every other field is derived from it.
--
-- DELIBERATELY PLAIN SQL. The first version of this used AUTOINCREMENT, a
-- foreign key, a DESC index column and a UNIQUE index over IFNULL(party_id,'')
-- — and D1 answered with a bare "internal error [code 7500]" that named none
-- of them. Every one of those was decoration: the rowid is already an integer
-- key, D1 does not enforce foreign keys by default, index ordering buys
-- nothing at this size, and two partial indexes say what the expression index
-- was saying. What is left is the part that was doing work.

CREATE TABLE IF NOT EXISTS songs (
  id          INTEGER PRIMARY KEY,
  pool        TEXT NOT NULL,               -- EVENT | HOUSE
  party_id    TEXT,                        -- set when pool = EVENT
  url         TEXT NOT NULL,               -- as pasted
  provider    TEXT,                        -- SPOTIFY | YOUTUBE | SOUNDCLOUD | …
  title       TEXT,                        -- resolved from the link
  artist      TEXT,
  artwork     TEXT,
  by_name     TEXT,                        -- who asked for it
  by_contact  TEXT,                        -- optional, never shown publicly
  status      TEXT NOT NULL DEFAULT 'NEW', -- NEW | PLAYED | HIDDEN
  created_at  TEXT NOT NULL,
  ip          TEXT                         -- rate limiting only
);

CREATE INDEX IF NOT EXISTS songs_pool ON songs (pool, party_id, created_at);

-- The same track twice in one pool is noise, not enthusiasm. Two people
-- pasting different links to the same song will still both land — matching
-- across services needs an audio ID, not a URL.
CREATE UNIQUE INDEX IF NOT EXISTS songs_once_event ON songs (party_id, url) WHERE pool = 'EVENT';
CREATE UNIQUE INDEX IF NOT EXISTS songs_once_house ON songs (url) WHERE pool = 'HOUSE';

CREATE INDEX IF NOT EXISTS songs_ip ON songs (ip, created_at);
