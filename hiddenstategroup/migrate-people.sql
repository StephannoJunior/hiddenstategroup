-- How many people a request is for.
--   npx wrangler d1 execute hiddenstate --remote --command="ALTER TABLE requests ADD COLUMN people INTEGER NOT NULL DEFAULT 1"
ALTER TABLE requests ADD COLUMN people INTEGER NOT NULL DEFAULT 1;
