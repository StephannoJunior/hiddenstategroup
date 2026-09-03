# The three statements that cannot go in a file

SQLite has no `ADD COLUMN IF NOT EXISTS` and no `DROP INDEX IF EXISTS` that
behaves well inside a batch, and D1 abandons the rest of a file when one
statement fails. So these three are run one at a time, by hand, once.

Run `migrate-next.sql` first — it holds everything else and is safe to repeat.

```
npx wrangler d1 execute hiddenstate --remote --file=./migrate-next.sql
```

Then these three, in order. **Each one is expected to fail if you have already
run it** (`duplicate column name`, `no such index`). That failure is safe and
means the change is already in place — move on to the next.

### 1. Who sent this guest — G09

```
npx wrangler d1 execute hiddenstate --remote --command "ALTER TABLE requests ADD COLUMN referrer TEXT"
```

The pass code of whoever forwarded the invite, so you can see who brings
people. Nothing is shown to the person filling the form; it arrives in the
link.

### 2. How long an offered place is held — N05

```
npx wrangler d1 execute hiddenstate --remote --command "ALTER TABLE requests ADD COLUMN offer_expires TEXT"
```

When somebody cancels and the next person on the waiting list is offered the
place, this is the moment the offer lapses and it passes to the person behind
them. Without it an unanswered offer freezes the queue forever.

### 3. Let one pass be scanned more than once — N02 and N03

```
npx wrangler d1 execute hiddenstate --remote --command "DROP INDEX idx_scans_admitted"
```

**Read this one before running it.**

That index was a `UNIQUE` index on `(code, party_id)` for admitted scans, and
it is what has been enforcing "a pass works once". It has done a real job:
it made a screenshotted code useless at the door.

It also makes plus-ones and re-entry impossible, because both of them mean a
second admitted scan against the same code. So the rule moves from the
database into the Worker, where it can count instead of refuse:

- a pass admits `admits` people (1 unless you set it higher), and the door
  refuses the scan *after* that many;
- an EXIT scan puts one of them back, so re-entry costs nothing;
- everything is still one row per scan in `scans`, so the history is
  unchanged and a run of refusals against one code still shows up.

**The protection is not weakened, it is moved.** But it is moved into code,
so it is worth checking after deploying: scan one pass twice and confirm the
second is refused with *already inside* before you rely on it at a door.
`npm run test:door` covers the counting; only the live scanner can confirm
the wiring.
