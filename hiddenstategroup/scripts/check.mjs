/*
  THE CONSISTENCY CHECK.

  Run:  npm run check

  Everything here is a string in one file agreeing with a string in another,
  which is exactly the kind of mistake a type-checker and a browser both miss:
  a setting nothing reads, a control that saves into nowhere, an api call to a
  route that does not exist. None of it throws. It just quietly does nothing,
  and you find out weeks later when you wonder why a switch has no effect.

  Five checks:
    1. every declared setting is published, controllable and actually read
    2. the settings index matches the sections that exist
    3. every site.<setting> read is a real setting
    4. every api.<fn>() call is exported
    5. every /api path called is answered by a route

  Exits non-zero on any finding, so it can gate a deploy.
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (f) => readFileSync(join(ROOT, f), "utf8");

const worker = read("worker/index.js");
const apiSrc = read("src/lib/api.js");
const consoleSrc = read("src/pages/Console.jsx");

const files = [];
(function walk(d) {
  for (const e of readdirSync(join(ROOT, d))) {
    const p = d + "/" + e;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(p)) files.push(p);
  }
})("src");

let problems = 0;
const bad = (m) => { console.log("  ✗ " + m); problems++; };
const good = (m) => console.log("  ok — " + m);

/* Comments are where false positives live: a path written in prose, a
   filename that looks like a property. Strip them before matching. */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const defaultsBlock = worker.slice(worker.indexOf("const DEFAULT_SETTINGS = {"));
const defaultsBody = defaultsBlock.slice(0, defaultsBlock.indexOf("\n};"));
const KEYS = [...defaultsBody.matchAll(/^  ([A-Za-z][\w]*):/gm)].map((m) => m[1]);
const KEYSET = new Set(KEYS);

const pubBlock = worker.slice(worker.indexOf("const PUBLIC_SETTINGS = ["));
const PUBLISHED = new Set(
  [...pubBlock.slice(0, pubBlock.indexOf("];")).matchAll(/"([^"]+)"/g)].map((m) => m[1])
);

const siteSrc = files.filter((f) => f !== "src/pages/Console.jsx").map(read).join("\n");
const workerUse = worker.replace(defaultsBody, "");

console.log(`\n1. ${KEYS.length} settings — published, controllable, read`);
{
  const before = problems;
  for (const k of KEYS) {
    const word = new RegExp(`\\b${k}\\b`);
    const inConsole = new RegExp(`["'\`]${k}["'\`]|\\.${k}\\b`).test(consoleSrc);
    const usedSite = word.test(siteSrc);
    const usedWorker = word.test(workerUse);

    if (!usedSite && !usedWorker) bad(`${k} — declared and read by nothing`);
    else if (!inConsole) bad(`${k} — no control in the console`);
    else if (PUBLISHED.has(k) && !usedSite) bad(`${k} — published to every visitor but never read by the site`);
    else if (!PUBLISHED.has(k) && usedSite && !usedWorker) bad(`${k} — the site reads it but it is never sent, so it is always the default`);
  }
  if (problems === before) good(`all ${KEYS.length} wired end to end`);
}

console.log("\n2. the settings index matches the sections rendered");
{
  const before = problems;
  // Bounded by the array's own closing bracket. A fixed slice length ran
  // past it and started reading the component below as section names.
  const from = consoleSrc.indexOf("const SETTING_SECTIONS = [");
  const arr = consoleSrc.slice(from, consoleSrc.indexOf("];", from));
  const declared = [...arr.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const rendered = [...consoleSrc.matchAll(/<Section title="([^"]+)" \{\.\.\.saver\(/g)].map((m) => m[1]);
  for (const t of rendered) if (!declared.includes(t)) bad(`"${t}" is rendered but missing from SETTING_SECTIONS`);
  for (const t of declared) if (!rendered.includes(t)) bad(`SETTING_SECTIONS lists "${t}" but nothing renders it`);
  if (problems === before) good(`${declared.length} sections, all listed`);
}

console.log("\n3. every site.<setting> read is a real setting");
{
  const before = problems;
  let n = 0;
  for (const f of files) {
    for (const m of decomment(read(f)).matchAll(/\bsite\.([A-Za-z][\w]*)/g)) {
      n++;
      if (!KEYSET.has(m[1])) bad(`${f} reads site.${m[1]} — no such setting`);
    }
  }
  if (problems === before) good(`${n} reads, all real`);
}

console.log("\n4. every api.<fn>() call is exported");
{
  const before = problems;
  const exported = new Set(
    [...apiSrc.matchAll(/export (?:async )?(?:function|const) ([A-Za-z][\w]*)/g)].map((m) => m[1])
  );
  for (const f of files) {
    if (f.endsWith("lib/api.js")) continue;
    for (const m of decomment(read(f)).matchAll(/\bapi\.([A-Za-z][\w]*)\s*\(/g))
      if (!exported.has(m[1])) bad(`${f} calls api.${m[1]}() — not exported`);
  }
  if (problems === before) good(`${exported.size} exports, every call resolves`);
}

console.log("\n5. every /api path called is answered");
{
  const before = problems;
  const clean = decomment(worker);
  const paths = new Set();
  for (const m of decomment(apiSrc).matchAll(/call\(\s*[`"']\/([\w-]+)/g)) paths.add(m[1]);
  for (const m of decomment(apiSrc).matchAll(/fetch\(\s*[`"']\/api\/([\w-]+)/g)) paths.add(m[1]);
  for (const p of [...paths].sort()) {
    // Routes are matched three ways in the worker: an exact path, a prefix,
    // or a regex for the ones that carry an id. All three count.
    const answered =
      new RegExp(`path === "/${p}"`).test(clean) ||
      new RegExp(`path\\.startsWith\\("/${p}`).test(clean) ||
      new RegExp(`path\\.match\\(/\\^\\\\?/${p}\\b`).test(clean);
    if (!answered) bad(`api.js calls /${p} — no worker route answers it`);
  }
  if (problems === before) good(`${paths.size} paths, all answered`);
}

console.log(problems ? `\n${problems} problem(s)\n` : "\nnothing to fix\n");
process.exit(problems ? 1 : 0);
