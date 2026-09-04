# Runbook

What to type when something needs doing. Everything here is safe to read;
the two commands that change anything are marked.

---

## Before you push

    npm run check        # settings wired to nothing, tokens, dead routes
    npm run test:door    # the offline door queue
    npm run test:restore # the backup rehearsal
    npm run build
    npm run smoke        # sixteen pages in a real browser

GitHub runs all five on every push to `main`. If they pass there, the branch
is safe to deploy. It does not deploy for you — that is still your button.

---

## Putting it live

### Try it first, on a real URL, without touching the live site

    npm run deploy:try

This uploads the build as a **version** and prints a preview URL of its own —
something like `https://a1b2c3-hiddenstategroup1.<your-subdomain>.workers.dev`.
Nobody visiting hiddenstategroup.com sees any of it. Open the preview on your
phone, walk through the door flow, look at the glass bar on iOS, and only then
promote it.

**Read this before you use it.** A preview version is a preview of the *code*,
not of the data. It is bound to the same D1 database and the same R2 bucket as
the live site, because that is what the bindings in `wrangler.jsonc` say. So:

- Issuing a pass on the preview issues a **real pass**.
- Deleting an event on the preview deletes the **real event**.
- Anything you do to settings on the preview changes the **live site's**
  settings immediately.

Use it to check that things *look* and *navigate* right. Do not use it to try
out destructive changes. If you ever need to do that safely, make a scratch
database (`npx wrangler d1 create hiddenstate-drill`), point a copy of
`wrangler.jsonc` at it, and deploy that — the restore drill below explains how
to fill it with real-shaped data.

The one thing a preview version does *not* share is the cron triggers: the
reminder, the weekly backup and the hourly health check only ever run on the
live version. A preview will never email a guest.

### Actually go live — CHANGES THE PUBLIC SITE

    npm run deploy

### Migrations — CHANGES THE DATABASE

One `--command` per statement; D1 rejects a file with several in it.

    npx wrangler d1 execute hiddenstate --remote --file=migrate-votes.sql
    npx wrangler d1 execute hiddenstate --remote --file=migrate-votes-index.sql
    npx wrangler d1 execute hiddenstate --remote --file=migrate-votes-index2.sql
    npx wrangler d1 execute hiddenstate --remote --file=migrate-oops.sql
    npx wrangler d1 execute hiddenstate --remote --file=migrate-oops-index.sql
    npx wrangler d1 execute hiddenstate --remote --file=migrate-next.sql

Every file above is written so that running it twice does nothing the second
time. If you lose track of which have been applied, run them all.

Then the three that **cannot** be written that way — SQLite has no
`ADD COLUMN IF NOT EXISTS`, and D1 abandons the rest of a file after one
statement fails, so these go one at a time:

    npx wrangler d1 execute hiddenstate --remote --command "ALTER TABLE requests ADD COLUMN referrer TEXT"
    npx wrangler d1 execute hiddenstate --remote --command "ALTER TABLE requests ADD COLUMN offer_expires TEXT"
    npx wrangler d1 execute hiddenstate --remote --command "DROP INDEX idx_scans_admitted"

Each is *expected* to fail if you have already run it (`duplicate column
name`, `no such index`). That failure is safe and means the change is already
there.

**Read `migrate-next-alter.md` before the third one.** Dropping that index is
what makes plus-ones and re-entry possible, and it is also what has been
enforcing "a pass works once". The rule moves into the Worker, which counts
admissions minus exits against each pass's own `admits` — not weakened, but
moved into code. Confirm it at a door before you rely on it: scan one
single-place pass twice and check the second is refused.

---

## Backups

The Worker writes a dump of every table into R2 at 04:00 every Monday, under
`backups/`, and keeps the last twelve. That prefix is refused by the public
`/media/` route, so a backup is never reachable from the internet.

The console's **BACKUPS** tab lists them, takes one on demand, and downloads
one.

### Restoring

    node scripts/restore.mjs <the backup you downloaded>.json

Writes `restore.sql` and prints the command to apply it. It never applies it
itself, on purpose.

### The drill — do this once, properly

`npm run test:restore` rehearses the conversion on every push. That catches
the escaping bugs, which is most of them, but it never touches a database.
Once, do the real thing end to end:

    npx wrangler d1 create hiddenstate-drill
    npx wrangler d1 execute hiddenstate-drill --remote --file=schema.sql
    node scripts/restore.mjs backup.json
    npx wrangler d1 execute hiddenstate-drill --remote --file=restore.sql
    npx wrangler d1 execute hiddenstate-drill --remote --command "SELECT COUNT(*) FROM passes"
    npx wrangler d1 delete hiddenstate-drill

If that last count matches what the live database holds, the backups are real
and you can stop wondering. Until you have done it, they are a file that makes
you feel safe.

---

## When something is wrong

**The console's FAULTS tab** lists what has broken in visitors' browsers —
message, where in the code, which page, which browser family, and how many
times. Nothing that identifies anyone. It is empty when nothing is wrong,
which is the point.

**The console's ACTIVITY tab** is the record: passes scanned, settings
changed, team changes. Read only.

**The hourly health check** emails you when the database, the bucket or the
mail key stops answering — once per fault, not once an hour. It cannot tell
you the site is unreachable, because if the Worker is down it does not run
either. That needs something watching from outside Cloudflare.

    curl https://hiddenstategroup.com/api/health

is the same check, by hand.

---

## Rolling back

Cloudflare keeps every version you have ever deployed. In the dashboard:
Workers → hiddenstategroup1 → Deployments → find the last good one → Rollback.
It takes seconds and needs nothing from this repo.

A rollback undoes the **code**. It does not undo a migration, and it does not
undo anything anyone typed into the console. If a bad deploy corrupted data,
roll the code back first — that stops the bleeding — then restore from the
most recent good backup.
