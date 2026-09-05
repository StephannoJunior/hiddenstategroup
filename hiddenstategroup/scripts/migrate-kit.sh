#!/usr/bin/env bash
#
#  THE PRESS-KIT MIGRATION, WITHOUT THE IMPORT ENDPOINT.
#
#  `wrangler d1 execute --file=…` does not send SQL to the database the way
#  --command does. It uploads the file and asks Cloudflare to IMPORT it, which
#  is a different API route with its own permissions — /d1/database/<id>/import
#  rather than /query. A token that deploys Workers and runs queries perfectly
#  well can still be refused by that one, and the refusal comes back as a bare
#  "Authentication error [code: 10000]" that says nothing about which route it
#  was.
#
#  So this sends the same four statements one at a time down the ORDINARY
#  route. It is the same migration; only the door it goes through changes.
#
#  Every statement is IF NOT EXISTS, so running it twice is harmless and
#  running it after a half-finished attempt is the way to finish the job.
#
set -euo pipefail
DB=hiddenstate

run() {
  echo "→ $1"
  npx wrangler d1 execute "$DB" --remote --yes --command "$2"
}

run "epk_extra — the kit fields that are not columns" \
  "CREATE TABLE IF NOT EXISTS epk_extra (artist_id INTEGER PRIMARY KEY, data TEXT, updated_at TEXT, updated_by TEXT);"

run "share_secrets — the word on a shared kit, hashed" \
  "CREATE TABLE IF NOT EXISTS share_secrets (token TEXT PRIMARY KEY, hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT);"

run "share_opens — when a link was opened, never by whom" \
  "CREATE TABLE IF NOT EXISTS share_opens (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL, at TEXT NOT NULL);"

run "the index that makes the open log readable" \
  "CREATE INDEX IF NOT EXISTS idx_opens_token ON share_opens(token, at);"

echo
echo "── what the database now has ──────────────────────────────────────────"
npx wrangler d1 execute "$DB" --remote --yes --command \
  "SELECT name FROM sqlite_master WHERE name IN ('epk_extra','share_secrets','share_opens','idx_opens_token') ORDER BY name;"
