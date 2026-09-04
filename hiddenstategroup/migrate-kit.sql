-- ─────────────────────────────────────────────────────────────────────────
-- Everything the press kit needs to become something you upload into.
--
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-kit.sql
--
-- Every statement is CREATE ... IF NOT EXISTS, so running it twice does
-- nothing the second time. There are no ALTERs at all this round — see the
-- note on epk_extra for why.
-- ─────────────────────────────────────────────────────────────────────────


-- ─── THE REST OF THE KIT ───────────────────────────────────────────────────
-- K09–K14. A stage plot, selected dates, press quotes, something to listen
-- to, a showreel, the booking contact and the territories it covers.
--
-- WHY ONE JSON COLUMN AND NOT SEVEN REAL ONES.
--
-- A press kit is a document, not a set of records. Nothing here is ever
-- queried, sorted or joined — it is written whole by one person and read
-- whole by one promoter. A column per field would buy nothing and cost an
-- ALTER every time the kit grows a section, and an ALTER is the one migration
-- that cannot be safely repeated. This way the kit can gain a section next
-- month with no migration at all.
--
-- The rule that keeps this honest: anything that ever needs to be FOUND gets
-- a real column. So far nothing here does.
CREATE TABLE IF NOT EXISTS epk_extra (
  artist_id  INTEGER PRIMARY KEY,
  data       TEXT,       -- JSON. See KIT_SHAPE in the worker for what is in it.
  updated_at TEXT,
  updated_by TEXT
);


-- ─── A WORD ON THE DOOR ────────────────────────────────────────────────────
-- K20. An optional password on a share link, for a kit with an unannounced
-- release in it.
--
-- ITS OWN TABLE rather than a column on share_links, for two reasons. A
-- migration that only adds tables can be run again without thinking, which
-- matters when it is being run at night by one person over a phone. And a
-- secret in its own table is a secret that a careless `SELECT *` on the links
-- list cannot leak into a console screen.
--
-- Hashed and salted the same way a team password is. A link password is
-- low-stakes — it stops a forwarded link working for somebody who was not
-- told the word, and that is all it claims to do — but "low-stakes" is not a
-- reason to store it in the clear, and someone will reuse a real password
-- here whatever the page says.
CREATE TABLE IF NOT EXISTS share_secrets (
  token      TEXT PRIMARY KEY,
  hash       TEXT NOT NULL,
  salt       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);


-- ─── WHO HAS OPENED IT ─────────────────────────────────────────────────────
-- K17. share_links already counts opens and remembers the last one. This is
-- the shape of it over time — enough to see that a promoter came back to the
-- kit four times this week, which is a reason to write to them.
--
-- WHAT IS DELIBERATELY NOT HERE: no address, no identifier, no user agent, no
-- referrer, nothing about the person at all. A timestamp and the token. The
-- useful fact is "this link is being read"; anything more would be
-- surveillance of somebody who was sent a link in good faith.
--
-- Rows older than a year are swept by the health job — a fact that stops
-- being useful does not stop being a record of somebody.
CREATE TABLE IF NOT EXISTS share_opens (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opens_token ON share_opens(token, at);
