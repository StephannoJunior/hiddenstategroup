-- Hidden State — door system
--
-- Run this once against your D1 database:
--   npx wrangler d1 execute hiddenstate --remote --file=./schema.sql
--
-- Every table carries created_at so anything can be traced back later. Times
-- are ISO strings in UTC; the site converts to the visitor's timezone.

-- ─── EVENTS ────────────────────────────────────────────────────────────────
-- A night. Passes belong to one, and die with it.
CREATE TABLE IF NOT EXISTS parties (
  id             TEXT PRIMARY KEY,          -- e.g. dec13
  name           TEXT NOT NULL,             -- 13.12.2026
  date_label     TEXT NOT NULL,             -- 13 December 2026
  venue          TEXT,                      -- null while undisclosed
  doors_close_at TEXT NOT NULL,             -- ISO. After this, passes stop working
  minimum_age    INTEGER NOT NULL DEFAULT 16,
  capacity       INTEGER,                    -- room limit, so the door knows when full
  rotating       INTEGER NOT NULL DEFAULT 1,-- 1 = code refreshes, 0 = fixed
  archived       INTEGER NOT NULL DEFAULT 0,-- hidden from the picker, never deleted
  created_at     TEXT NOT NULL,
  created_by     TEXT
);

-- ─── PASSES ────────────────────────────────────────────────────────────────
-- One row per issued pass. Codes come from the pre-generated pool.
CREATE TABLE IF NOT EXISTS passes (
  code        TEXT PRIMARY KEY,             -- HS-XXXXXX
  party_id    TEXT NOT NULL,
  name        TEXT NOT NULL,                -- the holder. This is what stops resale
  email       TEXT,
  phone       TEXT,
  kind        TEXT NOT NULL DEFAULT 'TICKET', -- TICKET | INVITATION | GUEST | PRESS | ARTIST | STAFF
  tier        TEXT,                         -- EARLY | STANDARD | VIP | null
  admits      INTEGER NOT NULL DEFAULT 1,   -- 2 for a couple, more for family
  ticket_ref  TEXT,                         -- printed on the physical ticket
  note        TEXT,                         -- the guest's own 150 characters
  id_required INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | REVOKED
  revoked_at  TEXT,
  revoked_by  TEXT,
  revoke_note TEXT,
  issued_at   TEXT NOT NULL,
  issued_by   TEXT NOT NULL,
  emailed_at  TEXT,
  reminded_at TEXT,                         -- so a reminder is never sent twice
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

CREATE INDEX IF NOT EXISTS idx_passes_party  ON passes(party_id);
CREATE INDEX IF NOT EXISTS idx_passes_status ON passes(status);
CREATE INDEX IF NOT EXISTS idx_passes_email  ON passes(email);

-- ─── ADMISSIONS ────────────────────────────────────────────────────────────
-- Separate from passes so one pass can have many attempts recorded. A run of
-- refusals against one code usually means a screenshot is circulating.
CREATE TABLE IF NOT EXISTS scans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL,
  party_id   TEXT NOT NULL,
  result     TEXT NOT NULL,                 -- ADMITTED | REFUSED
  reason     TEXT,                          -- why, when refused
  scanned_by TEXT NOT NULL,                 -- which team member
  scanned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scans_code  ON scans(code);
CREATE INDEX IF NOT EXISTS idx_scans_party ON scans(party_id);

-- Fast "has this pass already been admitted tonight" check.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_admitted
  ON scans(code, party_id) WHERE result = 'ADMITTED';

-- ─── TEAM ──────────────────────────────────────────────────────────────────
-- Password hashes never leave the server. Each person gets their own row so
-- one can be removed without disturbing anyone else.
CREATE TABLE IF NOT EXISTS team (
  username      TEXT PRIMARY KEY,
  role          TEXT NOT NULL,              -- BOSS | OWNER | STAFF
  display_name  TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  photo_url     TEXT,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  permissions   TEXT,                        -- JSON. Overrides the role's defaults
  active        INTEGER NOT NULL DEFAULT 1, -- 0 suspends without deleting history
  created_at    TEXT NOT NULL,
  created_by    TEXT
);

-- ─── SESSIONS ──────────────────────────────────────────────────────────────
-- Only the hash of a session token is stored, so a leaked database cannot be
-- used to impersonate anyone.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  role       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen  TEXT                            -- for the optional idle timeout
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- ─── GUEST LIST REQUESTS ───────────────────────────────────────────────────
-- What arrives from the public form, before anyone decides on it.
CREATE TABLE IF NOT EXISTS requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id   TEXT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  note       TEXT,
  people     INTEGER NOT NULL DEFAULT 1,   -- a request may be for more than one
  status     TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | DECLINED
  pass_code  TEXT,                          -- filled in once approved
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

-- ─── CODE POOL ─────────────────────────────────────────────────────────────
-- Pre-generated, unambiguous codes. Issuing takes the first unused one, so
-- codes are never invented on the fly and can never collide.
CREATE TABLE IF NOT EXISTS code_pool (
  code     TEXT PRIMARY KEY,
  used     INTEGER NOT NULL DEFAULT 0,
  used_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_pool_used ON code_pool(used);

-- ─── LOGIN ATTEMPTS ────────────────────────────────────────────────────────
-- Counted per address so passwords cannot be tried at machine speed.
-- Old rows are harmless; only recent failures are looked at.
CREATE TABLE IF NOT EXISTS login_attempts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ip       TEXT NOT NULL,
  username TEXT,
  ok       INTEGER NOT NULL,
  at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_ip ON login_attempts(ip, at);

-- ─── SETTINGS ──────────────────────────────────────────────────────────────
-- Anything the boss can change without a deploy. Stored as text; the code
-- knows what shape each value should be.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);
