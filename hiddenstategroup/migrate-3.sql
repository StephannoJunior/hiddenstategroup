-- Start time, set times, and reminder tracking.
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-3.sql
--
-- "duplicate column" means that part already ran and can be ignored.
ALTER TABLE parties ADD COLUMN starts_at TEXT;
ALTER TABLE parties ADD COLUMN lineup TEXT;
ALTER TABLE passes ADD COLUMN reminded_at TEXT;
