/*
  restore — turn a backup back into a database.

  ── WHY THIS EXISTS ─────────────────────────────────────────────────────────

  A backup nobody has ever restored is not a backup. It is a file that makes
  you feel safe. The weekly job has been writing dumps into R2 for a while
  now and not one of them has ever been read back, which means the honest
  status of this site's backups is "unknown" — right up until the night you
  need one, which is the worst possible moment to find out the format is
  wrong, a table is missing, or the whole thing truncated at ten thousand
  rows without saying so.

  So: this reads a dump and writes the SQL that puts it back. Running it costs
  nothing and touches nothing. Applying its output is a deliberate second
  step, and the script tells you the exact command.

  ── USE ─────────────────────────────────────────────────────────────────────

    node scripts/restore.mjs backup.json              → writes restore.sql
    node scripts/restore.mjs backup.json --out x.sql  → somewhere else
    node scripts/restore.mjs backup.json --only songs,passes
    node scripts/restore.mjs --drill                  → rehearse, no file needed

  Get a dump first: the console's BACKUPS tab lists them and downloads one.

  ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────

  It never runs wrangler itself. Restoring over a live database is a decision
  with consequences, and a script that can take that decision on your behalf
  is a script that will eventually take it by accident — a stray argument, a
  shell history recall at 3am. It writes a file and prints a command. You
  type the command.
*/

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf("--" + name);
  return i === -1 ? null : (args[i + 1] || "");
};
const has = (name) => args.includes("--" + name);

/*
  ── ESCAPING ────────────────────────────────────────────────────────────────

  This is the part that goes wrong quietly. A value with an apostrophe in it —
  a song called "Don't" — breaks the statement, and depending on what follows
  it can break it into something that still parses and means something else.
  So every value goes through here and nothing is ever interpolated raw.

  SQLite's rule for a string literal is: wrap in single quotes, double any
  single quote inside. Newlines and unicode need no treatment at all; they are
  legal inside a literal, and escaping them with backslashes — the instinct
  from other languages — would store the backslashes.

  A blob comes back from D1 as an array of bytes, and goes back in as X'..'
  hex. A number goes in bare, but only if it is finite: Infinity and NaN have
  no SQL spelling and become NULL rather than the word "Infinity", which
  SQLite would happily store as a string.
*/
function literal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Uint8Array || Array.isArray(v)) {
    const bytes = Array.from(v);
    if (!bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) {
      // Not a blob after all — an array of something. Store it as its JSON,
      // which is at least lossless and readable.
      return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
    }
    return "X'" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("") + "'";
  }
  if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// An identifier — a table or column name — is quoted with double quotes and
// any double quote inside is doubled. These come out of the database's own
// catalogue, so they cannot be hostile, but a column called "order" is a
// reserved word and would fail unquoted.
const ident = (name) => '"' + String(name).replace(/"/g, '""') + '"';

/*
  ── ROWS TO SQL ─────────────────────────────────────────────────────────────

  One INSERT per batch of rows rather than one per row. D1 charges per
  statement and a table of eight thousand rows as eight thousand statements
  is slow enough to time out; as a hundred and sixty statements it is not.

  A row missing a column that other rows have — which happens when a column
  was added partway through the table's life and the dump preserves that —
  would silently shift values into the wrong columns if the column list came
  from the first row alone. So the column list is the union of every row's
  keys, and a row that lacks one contributes NULL for it.
*/
const BATCH = 50;

function tableSql(name, rows) {
  const out = [];
  out.push(`-- ${name}: ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  out.push(`DELETE FROM ${ident(name)};`);
  if (!rows.length) return out;

  const cols = [];
  const seen = new Set();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) { seen.add(k); cols.push(k); }
    }
  }

  const head = `INSERT INTO ${ident(name)} (${cols.map(ident).join(", ")}) VALUES`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk
      .map((r) => "  (" + cols.map((c) => literal(r[c])).join(", ") + ")")
      .join(",\n");
    out.push(head + "\n" + values + ";");
  }
  return out;
}

/*
  ── ORDER ───────────────────────────────────────────────────────────────────

  Tables are deleted in the reverse of the order they are filled, so a child
  row never outlives its parent even if foreign keys are being enforced. The
  fill order puts the tables everything else points at first — parties before
  passes, people before anything. Anything not named is alphabetical and goes
  after, which is the safe place for it: by then its parents exist.

  This list is deliberately hand-written. Deriving it from the schema would be
  cleverer and would break the day someone adds a table.
*/
const FIRST = [
  // Nothing points at these.
  "settings", "team", "artists", "records", "mixes", "posts",
  // Everything at a door points at a party.
  "parties",
  // Then the things that point at a party.
  "passes", "requests", "songs",
  // Then the things that point at those.
  "scans", "song_votes",
];

function order(names) {
  const known = FIRST.filter((n) => names.includes(n));
  const rest = names.filter((n) => !FIRST.includes(n)).sort();
  return [...known, ...rest];
}

/*
  ── THE DRILL ───────────────────────────────────────────────────────────────

  A rehearsal that needs no backup file and no database. It builds a dump
  containing every shape of value that has ever caused a restore to fail
  somewhere, converts it, and checks the result reads back as what went in.

  This is not a substitute for restoring into a real scratch database — the
  README says how to do that and you should, once — but it is the part that
  can run on every commit, and it is the part that catches the escaping bugs.
*/
function drill() {
  const sample = {
    taken: new Date().toISOString(),
    database: "drill",
    truncated: [],
    tables: {
      parties: [
        { id: 1, name: "Don't Look Back", date_label: "SAT 12", archived: 0 },
        { id: 2, name: 'He said "hello"', date_label: null, archived: 0 },
      ],
      songs: [
        { id: "a", title: "Ünïcödé — em dash", artist: "Ω", n: 3.5 },
        { id: "b", title: "line one\nline two", artist: "", n: 0 },
        { id: "c", title: "'; DROP TABLE songs; --", artist: null, n: -1 },
        { id: "d", title: "backslash \\ and tab \t", artist: "x", n: Infinity },
        { id: "e", title: "extra column here", artist: "y", n: 1, added_later: "ok" },
      ],
      empty_table: [],
    },
  };

  const checks = [];
  const say = (ok, what) => { checks.push({ ok, what }); };

  const sql = build(sample).text;

  say(sql.includes("'Don''t Look Back'"), "an apostrophe is doubled, not escaped");
  say(sql.includes(`'He said "hello"'`), "a double quote passes through untouched");
  say(sql.includes("'Ünïcödé — em dash'"), "unicode survives");
  say(sql.includes("'line one\nline two'"), "a newline stays a newline inside the literal");
  say(sql.includes("'''; DROP TABLE songs; --'"), "an injection attempt becomes one harmless string");
  say(sql.includes("'backslash \\ and tab \t'"), "a backslash is NOT escaped — SQLite would store the extra one");
  say(!/Infinity/.test(sql), "Infinity becomes NULL rather than the word");
  say(sql.includes("added_later"), "a column only some rows have is still in the column list");

  // Every row of every table accounted for, and every table cleared first.
  const inserted = (sql.match(/^\s{2}\(/gm) || []).length;
  const total = Object.values(sample.tables).reduce((n, r) => n + r.length, 0);
  say(inserted === total, `every row is written (${inserted} of ${total})`);
  say((sql.match(/^DELETE FROM/gm) || []).length === Object.keys(sample.tables).length,
      "every table is cleared before it is filled");

  /*
    Order. Tables are FILLED parents-first and CLEARED children-first, so a
    row never sits for a moment pointing at a parent that has been deleted.
    That means the delete block must read as the exact reverse of the fill
    order — which is the check.
  */
  const expected = order(Object.keys(sample.tables));
  const wipes = [...sql.matchAll(/^DELETE FROM "([^"]+)"/gm)].map((m) => m[1]);
  const fills = [...new Set([...sql.matchAll(/^INSERT INTO "([^"]+)"/gm)].map((m) => m[1]))];
  say(JSON.stringify(wipes) === JSON.stringify([...expected].reverse()),
      "tables are cleared in the reverse of the order they are filled");
  say(JSON.stringify(fills) === JSON.stringify(expected.filter((t) => sample.tables[t].length)),
      "parents are filled before the tables that point at them");

  let bad = 0;
  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.what}`);
    if (!c.ok) bad += 1;
  }
  console.log("");
  if (bad) {
    console.log(`  ${bad} of ${checks.length} failed. The restore path is NOT safe.`);
    process.exit(1);
  }
  console.log(`  ${checks.length} checks passed. A dump in this format restores cleanly.`);
  console.log("");
  console.log("  This rehearsed the conversion, not the database. Once — and once is");
  console.log("  enough — do the real thing:");
  console.log("");
  console.log("    npx wrangler d1 create hiddenstate-drill");
  console.log("    npx wrangler d1 execute hiddenstate-drill --remote --file=schema.sql");
  console.log("    node scripts/restore.mjs <a real backup.json>");
  console.log("    npx wrangler d1 execute hiddenstate-drill --remote --file=restore.sql");
  console.log("    npx wrangler d1 execute hiddenstate-drill --remote \\");
  console.log("      --command \"SELECT COUNT(*) FROM passes\"");
  console.log("    npx wrangler d1 delete hiddenstate-drill");
  console.log("");
  console.log("  If that count matches the live one, the backups are real.");
}

function build(dump, only = null) {
  if (!dump || typeof dump !== "object" || !dump.tables) {
    throw new Error("That file is not a backup — no 'tables' in it.");
  }

  let names = Object.keys(dump.tables);
  if (only) {
    const want = only.split(",").map((s) => s.trim()).filter(Boolean);
    const missing = want.filter((w) => !names.includes(w));
    if (missing.length) throw new Error("Not in this backup: " + missing.join(", "));
    names = want;
  }
  const filled = order(names);

  const lines = [];
  lines.push("-- Restored from a Hidden State backup.");
  lines.push(`-- Taken:  ${dump.taken || "unknown"}`);
  lines.push(`-- Source: ${dump.database || "unknown"}`);
  lines.push(`-- Made:   ${new Date().toISOString()}`);
  if (dump.truncated && dump.truncated.length) {
    lines.push("--");
    lines.push("-- WARNING. These tables hit the dump's row cap and are INCOMPLETE:");
    lines.push("--   " + dump.truncated.join(", "));
    lines.push("-- Restoring this will lose the rows beyond the cap.");
  }
  lines.push("--");
  lines.push("-- This REPLACES the contents of every table below. It does not create");
  lines.push("-- them: run schema.sql first if the database is empty.");
  lines.push("");

  // Cleared in reverse of the fill order, so nothing is orphaned on the way.
  for (const name of [...filled].reverse()) {
    lines.push(`DELETE FROM ${ident(name)};`);
  }
  lines.push("");

  let rows = 0;
  for (const name of filled) {
    const list = dump.tables[name] || [];
    rows += list.length;
    // tableSql emits its own DELETE; drop it, the block above did them all in
    // the right order. Keeping both would be harmless but misleading.
    for (const line of tableSql(name, list)) {
      if (line.startsWith("DELETE FROM")) continue;
      lines.push(line);
    }
    lines.push("");
  }

  return { text: lines.join("\n"), tables: filled.length, rows };
}

// ── run ─────────────────────────────────────────────────────────────────────

if (has("drill")) {
  console.log("");
  console.log("  RESTORE DRILL");
  console.log("");
  drill();
  process.exit(0);
}

const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out" &&
                              args[args.indexOf(a) - 1] !== "--only");
if (!file) {
  console.log("");
  console.log("  node scripts/restore.mjs <backup.json>   turn a backup into restore.sql");
  console.log("  node scripts/restore.mjs --drill         rehearse without one");
  console.log("");
  console.log("  Download a backup from the console's BACKUPS tab.");
  console.log("");
  process.exit(1);
}

let dump;
try {
  dump = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.log(`\n  Could not read ${file}: ${e.message}\n`);
  process.exit(1);
}

let made;
try {
  made = build(dump, flag("only"));
} catch (e) {
  console.log(`\n  ${e.message}\n`);
  process.exit(1);
}

const out = flag("out") || "restore.sql";
fs.writeFileSync(out, made.text);

console.log("");
console.log(`  Wrote ${path.basename(out)} — ${made.tables} tables, ${made.rows} rows.`);
if (dump.truncated && dump.truncated.length) {
  console.log(`  INCOMPLETE: ${dump.truncated.join(", ")} were cut short in the backup.`);
}
console.log("");
console.log("  Into a scratch database first — always:");
console.log(`    npx wrangler d1 execute hiddenstate-drill --remote --file=${out}`);
console.log("");
console.log("  Over the live one, only when you mean it:");
console.log(`    npx wrangler d1 execute hiddenstate --remote --file=${out}`);
console.log("");
