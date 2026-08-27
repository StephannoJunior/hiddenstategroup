-- Per-account permissions. Run after migrate-4.
--   npx wrangler d1 execute hiddenstate --remote --file=./migrate-5.sql
ALTER TABLE team ADD COLUMN permissions TEXT;
