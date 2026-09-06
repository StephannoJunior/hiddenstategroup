-- ── DRAFTS ──────────────────────────────────────────────────────────────────
--
-- A draft is a set of edits that have NOT been applied to the real record yet.
-- It is not the same thing as `published = 0`, and keeping the two apart is
-- the point of the table:
--
--   published = 0   the record exists and is hidden. A finished thing waiting
--                   for a date.
--   a draft         the record may not exist at all, or may exist and be live,
--                   and these are the changes somebody is part-way through.
--                   Applying them is a separate act.
--
-- Conflating them is how a CMS publishes half a sentence: you edit the live
-- record directly and every keystroke is on the site.
--
-- `token` is 32 random hex characters that serve THIS draft — and only this
-- draft — to the real site at ?preview=<token>. It is what makes a preview
-- link sendable to a photographer who has no login and should never get one,
-- which also means the token IS the permission: it comes from
-- crypto.getRandomValues, and it dies with the draft.

CREATE TABLE IF NOT EXISTS drafts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,   -- artists | records | mixes
  ref        TEXT NOT NULL,   -- the record's key, or new-<nonce> for one that does not exist yet
  data       TEXT NOT NULL,   -- JSON of the record as it is being edited
  token      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- One draft per record. Two people editing the same thing share it rather than
-- each getting a private copy that silently overwrites the other's on publish.
CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_one ON drafts(kind, ref);
CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_token ON drafts(token);
