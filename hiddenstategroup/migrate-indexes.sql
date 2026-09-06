-- Two tables that are read on every page load and had nothing but a primary
-- key. Trivial at today's row counts — which is exactly when an index is a
-- five-minute job rather than a migration you schedule.
CREATE INDEX IF NOT EXISTS idx_pages_live ON pages(published, sort_order);
CREATE INDEX IF NOT EXISTS idx_slots_live ON slots(published);
