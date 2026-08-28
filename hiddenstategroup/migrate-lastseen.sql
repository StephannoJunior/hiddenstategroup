-- For the optional idle sign-out.
ALTER TABLE sessions ADD COLUMN last_seen TEXT;
