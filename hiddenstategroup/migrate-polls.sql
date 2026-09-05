-- ── THE POLLS ───────────────────────────────────────────────────────────────
--
-- A question, some options, and one vote per person per option.
--
-- WHY THE UNIQUE INDEX IS THE POINT. A poll is worth exactly as much as its
-- count, and a count is worth nothing if the same person can be in it twice.
-- That rule could live in the handler — read the voter's rows, compare, insert
-- — but a rule enforced by a read-then-write is not enforced at all the moment
-- two requests arrive together, which is precisely what happens when somebody
-- double-taps. So the database refuses it instead: two rows for the same voter
-- and option cannot exist, whatever order anything arrives in.
--
-- The per-poll LIMIT on how many options one person may pick is still counted
-- in the handler, because it is a policy rather than an identity. The
-- difference matters: a lost race there gives somebody one extra pick, which
-- is untidy. A lost race on identity gives somebody unlimited votes, which is
-- the whole poll.

CREATE TABLE IF NOT EXISTS polls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question    TEXT NOT NULL,
  note        TEXT,                     -- a line under the question
  audience    TEXT NOT NULL DEFAULT 'PUBLIC',   -- PUBLIC | TEAM
  picks       INTEGER NOT NULL DEFAULT 1,       -- how many options one person may choose
  status      TEXT NOT NULL DEFAULT 'DRAFT',    -- DRAFT | OPEN | CLOSED
  created_at  TEXT NOT NULL,
  created_by  TEXT,
  closed_at   TEXT
);

CREATE TABLE IF NOT EXISTS poll_options (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  label   TEXT NOT NULL,
  ord     INTEGER NOT NULL DEFAULT 0
);

-- No name, no address, no session: a vote records WHICH option and WHO ONLY as
-- the same opaque browser id the song pool uses. The address is here for the
-- rate limit and nothing else, exactly as the pool keeps it.
CREATE TABLE IF NOT EXISTS poll_votes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id   INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  voter     TEXT NOT NULL,
  at        TEXT NOT NULL,
  ip        TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_once ON poll_votes(poll_id, voter, option_id);
CREATE INDEX IF NOT EXISTS idx_poll_tally ON poll_votes(poll_id, option_id);
CREATE INDEX IF NOT EXISTS idx_poll_options ON poll_options(poll_id, ord);
CREATE INDEX IF NOT EXISTS idx_polls_open ON polls(audience, status);
