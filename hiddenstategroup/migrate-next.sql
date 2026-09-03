-- ─────────────────────────────────────────────────────────────────────────
-- Everything the eighteen new features need, in one file.
--
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-next.sql
--
-- Every statement is CREATE ... IF NOT EXISTS, so running it twice does
-- nothing the second time. The three statements that CANNOT be written that
-- way — two ALTERs and one DROP INDEX — are in migrate-next-alter.md instead,
-- one command each, because SQLite has no "ADD COLUMN IF NOT EXISTS" and a
-- failure partway through a file abandons the rest of it.
--
-- DESIGN NOTE. Several of these are side tables where a column on an existing
-- table would have been the obvious choice — door notes rather than
-- passes.door_note, set times rather than parties.lineup. That is deliberate:
-- a new table is idempotent and a new column is not, and this database is
-- migrated by hand, at night, by one person, over a phone connection. A
-- migration that cannot half-apply is worth an extra join.
-- ─────────────────────────────────────────────────────────────────────────


-- ─── SHARE LINKS ───────────────────────────────────────────────────────────
-- One mechanism, three uses: the door display on a wall (N01), an artist's
-- private page sent to a promoter (L02), and a guest forwarding their invite
-- (G09). All three are the same thing — a long unguessable string that grants
-- read access to exactly one object, with no login and no cookie.
--
-- WHY THEY EXPIRE. A link that works forever is a link that is still working
-- eighteen months after it was pasted into a group chat. `expires_at` NULL
-- means it does not expire, which is right for an artist's page and wrong for
-- everything else, so the code that creates them sets a date unless told not
-- to.
CREATE TABLE IF NOT EXISTS share_links (
  token      TEXT PRIMARY KEY,            -- 22+ random characters. Never guessable.
  kind       TEXT NOT NULL,               -- DOOR | EPK | INVITE
  ref        TEXT NOT NULL,               -- party id, artist id, or pass code
  label      TEXT,                        -- what to call it in the console
  expires_at TEXT,                        -- ISO, or NULL for no expiry
  uses       INTEGER NOT NULL DEFAULT 0,  -- opened this many times
  last_used  TEXT,
  revoked    INTEGER NOT NULL DEFAULT 0,  -- kill a link without deleting the record
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_kind ON share_links(kind, ref);


-- ─── A NOTE ON A NAME ──────────────────────────────────────────────────────
-- N04. What the door needs to know about someone the moment their code
-- scans: promoter's guest, artist plus one, do not admit.
--
-- `tone` is not decoration. At a door, in the dark, colour is read before
-- words are, and the difference between "give this person a drinks ticket"
-- and "do not let this person in" must not depend on anyone reading a
-- sentence at 2am.
CREATE TABLE IF NOT EXISTS door_notes (
  code       TEXT PRIMARY KEY,            -- the pass it belongs to
  note       TEXT NOT NULL,
  tone       TEXT NOT NULL DEFAULT 'INFO', -- INFO | GOOD | WARN | STOP
  created_at TEXT NOT NULL,
  created_by TEXT
);


-- ─── SET TIMES ─────────────────────────────────────────────────────────────
-- G06. The running order, on the pass and on the event page, changed from the
-- console during the night.
--
-- `at_label` is TEXT and not a timestamp on purpose. A running order is
-- written as "01:30" or "01:30 – 03:00" or "after Astryon", and forcing it
-- into a real time means someone has to decide what date 01:30 belongs to at
-- the exact hour nobody should be deciding anything.
CREATE TABLE IF NOT EXISTS set_times (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id   TEXT NOT NULL,
  name       TEXT NOT NULL,               -- who is playing
  at_label   TEXT,                        -- "01:30", "01:30 – 03:00", "TBA"
  room       TEXT,                        -- for a night with more than one
  note       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_settimes_party ON set_times(party_id, sort_order);


-- ─── RELEASE LINKS ─────────────────────────────────────────────────────────
-- L03. Every platform a record is on, in the order they should be listed.
-- Separate rows rather than a JSON blob because these get reordered, added to
-- one at a time, and edited by hand — all of which a blob makes worse.
CREATE TABLE IF NOT EXISTS release_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  record_slug TEXT NOT NULL,
  label       TEXT NOT NULL,              -- SPOTIFY | APPLE MUSIC | BEATPORT | …
  url         TEXT NOT NULL,
  presave     INTEGER NOT NULL DEFAULT 0, -- 1 = only shown BEFORE release day
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rlinks_record ON release_links(record_slug, sort_order);


-- ─── THE PRESS KIT ─────────────────────────────────────────────────────────
-- L02. One row per artist, holding the things a promoter asks for and nobody
-- can ever find. Reached through a share_links row of kind EPK, so the link
-- can be revoked without touching any of this.
CREATE TABLE IF NOT EXISTS epk (
  artist_id   INTEGER PRIMARY KEY,
  bio_short   TEXT,                       -- the 40-word one, for a flyer
  bio_long    TEXT,                       -- the 150-word one, for a programme
  rider       TEXT,                       -- technical requirements, plain text
  hospitality TEXT,
  photos      TEXT,                       -- JSON array of { url, credit, label }
  logos       TEXT,                       -- JSON array of { url, label }
  links       TEXT,                       -- JSON array of { label, url }
  contact     TEXT,                       -- who to write to for this artist
  updated_at  TEXT,
  updated_by  TEXT
);


-- ─── DEMOS ─────────────────────────────────────────────────────────────────
-- L01. A link, not a file. Everyone sends SoundCloud, Drive or WeTransfer
-- anyway, and accepting uploads would mean storing strangers' audio and
-- deciding how long to keep it.
CREATE TABLE IF NOT EXISTS demos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  artist     TEXT NOT NULL,               -- what they call themselves
  email      TEXT NOT NULL,
  url        TEXT NOT NULL,
  title      TEXT,
  note       TEXT,
  socials    TEXT,
  status     TEXT NOT NULL DEFAULT 'NEW', -- NEW | HEARD | YES | MAYBE | NO
  verdict    TEXT,                        -- the note to ourselves, never sent
  replied_at TEXT,
  heard_at   TEXT,
  decided_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demos_status ON demos(status, created_at);


-- ─── BOOKINGS ──────────────────────────────────────────────────────────────
-- L04. The questions you would have to ask anyway, asked once, up front.
CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  promoter   TEXT NOT NULL,
  company    TEXT,
  email      TEXT NOT NULL,
  phone      TEXT,
  artist     TEXT,                        -- who they want
  date_label TEXT,                        -- when. Free text: "March", "14/03"
  city       TEXT,
  country    TEXT,
  venue      TEXT,
  capacity   TEXT,                        -- text, because "800-1000" is an answer
  budget     TEXT,                        -- text, because currencies
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'NEW', -- NEW | TALKING | HELD | CONFIRMED | NO
  reply_note TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status, created_at);


-- ─── THE WAITING LIST ──────────────────────────────────────────────────────
-- N05. Not a new table: a request that arrives at a full night becomes a
-- WAITING request rather than a declined one, and is offered a place when
-- somebody cancels. The queue is the order they arrived in, which is the only
-- order anybody will accept as fair.
--
-- The two columns it needs are ALTERs, so they live in migrate-next-alter.md.
-- This index is here because it can be.
CREATE INDEX IF NOT EXISTS idx_requests_queue
  ON requests(party_id, status, created_at);


-- ─── THE MORNING AFTER ─────────────────────────────────────────────────────
-- G08. Recorded so the same letter is never sent twice, and so that "who has
-- been written to about which night" is a question with an answer.
CREATE TABLE IF NOT EXISTS afters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id   TEXT NOT NULL,
  sent_to    INTEGER NOT NULL DEFAULT 0,  -- how many letters went out
  subject    TEXT,
  body       TEXT,
  sent_at    TEXT NOT NULL,
  sent_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_afters_party ON afters(party_id);
