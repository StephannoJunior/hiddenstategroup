-- ── PAGES BUILT IN THE CONSOLE ──────────────────────────────────────────────
--
-- A page is a slug, some words, and an ordered list of blocks. Deliberately
-- the same shape as artists, records and sessions, which is what lets drafts,
-- the preview token and publishing work on it without a line of new code in
-- any of those routes.
--
-- `blocks` is JSON. It is a document, not a relation: nothing ever queries
-- across the blocks of different pages, and normalising it into a table would
-- buy a join and cost the ability to reorder a page by writing one row.

CREATE TABLE IF NOT EXISTS pages (
  slug            TEXT PRIMARY KEY,
  title           TEXT NOT NULL DEFAULT '',
  kicker          TEXT,
  sub             TEXT,
  blocks          TEXT NOT NULL DEFAULT '[]',
  in_nav          INTEGER NOT NULL DEFAULT 0,   -- gets a tab in the floating bar
  nav_label       TEXT,
  seo_description TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  published       INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT
);

-- ── BLOCKS ON THE PAGES THAT ALREADY EXIST ─────────────────────────────────
--
-- Not new pages: named seams in the hand-built ones. The id IS the place —
-- 'home:top', 'about:bottom' — which is what makes a two-part key fit a
-- one-column primary key, and therefore fit the same machinery as everything
-- above. The list of which places exist lives in src/lib/pages.js, because it
-- is a fact about the front end's layout rather than about the database.

CREATE TABLE IF NOT EXISTS slots (
  id         TEXT PRIMARY KEY,
  blocks     TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
