CREATE UNIQUE INDEX IF NOT EXISTS song_votes_once ON song_votes (song_id, voter);
