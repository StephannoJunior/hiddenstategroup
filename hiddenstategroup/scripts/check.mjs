/*
  THE CONSISTENCY CHECK.

  Run:  npm run check

  Everything here is a string in one file agreeing with a string in another,
  which is exactly the kind of mistake a type-checker and a browser both miss:
  a setting nothing reads, a control that saves into nowhere, an api call to a
  route that does not exist. None of it throws. It just quietly does nothing,
  and you find out weeks later when you wonder why a switch has no effect.

  Nine checks:
    1. every declared setting is published, controllable and actually read
    2. the settings index matches the sections that exist
    3. every site.<setting> read is a real setting
    4. every api.<fn>() call is exported
    5. every /api path called is answered by a route
    6. no name is both imported and declared in the same file
    7. every name a file reads is declared somewhere
    8. every write consults a session, or is named as deliberately public
    9. every import resolves to a real export in the file it names

  Exits non-zero on any finding, so it can gate a deploy.
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (f) => readFileSync(join(ROOT, f), "utf8");

/*
  THE WORKER IS SEVERAL FILES. The settings and their public list live in
  lib/core.js; the routes live in index.js and beside it. `worker` is the whole
  thing joined, because every check here asks a question about the worker as a
  program rather than about a file — and the moment core.js was split out, a
  version of this that still read index.js alone reported "0 settings" and
  seventy-six false failures. Loudly wrong, which is the right way for a check
  to break, but wrong.
*/
const worker = readdirSync(join(ROOT, "worker"))
  .flatMap((e) => {
    const p = "worker/" + e;
    return statSync(join(ROOT, p)).isDirectory()
      ? readdirSync(join(ROOT, p)).map((f) => p + "/" + f)
      : [p];
  })
  .filter((f) => f.endsWith(".js"))
  .map(read)
  .join("\n");
const apiSrc = read("src/lib/api.js");
/*
  THE CONSOLE IS FOUR FILES, NOT ONE.

  This read Console.jsx alone, which was true when it was written and has not
  been true for a while: the panels moved into ConsoleExtra, the press kits
  into KitEditor, and now the bar and the pool into ConsoleDesks. A control
  that had moved out of Console.jsx would have been reported as missing — so
  the check would have been failing honest code while a genuinely missing
  control elsewhere went unnoticed, which is the worst way round for a check
  to be wrong.

  `consoleSrc` stays Console.jsx alone, because check 2 reads the sections
  array out of it and that array genuinely does live in one place.
*/
const CONSOLE_FILES = [
  "src/pages/Console.jsx",
  "src/pages/ConsoleExtra.jsx",
  "src/pages/ConsoleDesks.jsx",
  "src/pages/Studio.jsx",
  "src/pages/KitEditor.jsx",
  // Panels that outgrew Console.jsx and moved into a directory of their own.
  ...readdirSync(join(ROOT, "src/pages/console"))
    .filter((f) => /\.jsx?$/.test(f))
    .map((f) => "src/pages/console/" + f),
];
const consoleSrc = read("src/pages/Console.jsx");
const consoleAll = CONSOLE_FILES.map(read).join("\n");

const files = [];
(function walk(d) {
  for (const e of readdirSync(join(ROOT, d))) {
    const p = d + "/" + e;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(p)) files.push(p);
  }
})("src");

/*
  The worker is a directory now, not a file. Checks 6 and 7 walk it the same
  way they walk src — which matters more here than anywhere else: splitting a
  monolith is exactly the operation that leaves a route calling a helper it no
  longer imports, and "every name resolves" is the check that catches it.
*/
const workerFiles = [];
(function walk(d) {
  for (const e of readdirSync(join(ROOT, d))) {
    const p = d + "/" + e;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p);
    else if (/\.js$/.test(p)) workerFiles.push(p);
  }
})("worker");

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
    const inConsole = new RegExp(`["'\`]${k}["'\`]|\\.${k}\\b`).test(consoleAll);
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
  /*
    READ ACROSS THE WHOLE CONSOLE, and refuse to pass on nothing.

    SETTING_SECTIONS moved out of Console.jsx when Settings did, and this
    check went on reporting "0 sections, all listed" — a pass, in green, that
    had stopped looking at anything. That is the worst way for a check to
    break, and the fix is two things rather than one: read the console as a
    set of files, AND treat an empty result as a failure, because there is no
    world in which this site has no settings sections.
  */
  const from = consoleAll.indexOf("const SETTING_SECTIONS = [");
  const arr = from === -1 ? "" : consoleAll.slice(from, consoleAll.indexOf("];", from));
  const declared = [...arr.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const rendered = [...consoleAll.matchAll(/<Section title="([^"]+)" \{\.\.\.saver\(/g)].map((m) => m[1]);
  if (!declared.length) bad("SETTING_SECTIONS was not found in any console file");
  if (!rendered.length) bad("no <Section> with a saver was found in any console file");
  for (const t of rendered) if (!declared.includes(t)) bad(`"${t}" is rendered but missing from SETTING_SECTIONS`);
  for (const t of declared) if (!rendered.includes(t)) bad(`SETTING_SECTIONS lists "${t}" but nothing renders it`);
  if (problems === before) good(`${declared.length} sections, all listed`);
}

console.log("\n3. every site.<setting> read is a real setting");
{
  const before = problems;
  /*
    Values the /site response adds that are NOT settings — derived from a
    table at the moment they are asked for. Named here for the same reason
    PUBLIC_SETTINGS is a list: so that adding one is a decision somebody made
    rather than a thing that happened.
  */
  const DERIVED = new Set(["navPages"]);
  let n = 0;
  for (const f of files) {
    for (const m of decomment(read(f)).matchAll(/\bsite\.([A-Za-z][\w]*)/g)) {
      n++;
      if (!KEYSET.has(m[1]) && !DERIVED.has(m[1])) bad(`${f} reads site.${m[1]} — no such setting`);
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
    /*
      Routes are matched four ways in the worker: an exact path, an exact path
      with further segments, a prefix, or a regex for the ones carrying an id.

      The second of those was missing, which had it both ways round: a call to
      /restore/drill was reported as unanswered even though the route exists,
      AND a call to /anything/else would have passed merely because /anything
      did. A check that is wrong in both directions at once is not a check.
    */
    const answered =
      new RegExp(`path === "/${p}"`).test(clean) ||
      new RegExp(`path === "/${p}/`).test(clean) ||
      new RegExp(`path\\.startsWith\\("/${p}`).test(clean) ||
      new RegExp(`path\\.match\\(/\\^\\\\?/${p}\\b`).test(clean);
    if (!answered) bad(`api.js calls /${p} — no worker route answers it`);
  }
  if (problems === before) good(`${paths.size} paths, all answered`);
}

/*
  ── 6 · A NAME IMPORTED AND ALSO DECLARED ──────────────────────────────────

  WHY THIS CHECK EXISTS. Home.jsx already had a local component called Mark —
  the hero block — and an import of the logo component, also called Mark, was
  added above it. That is a hard build failure, and it reached a build.

  It got that far because the type-check being run was doing SYNTAX checking
  only: `tsc --allowJs` without `--checkJs` never looks at what the names in a
  .jsx file mean, so a file can be perfectly well-formed and still declare the
  same name twice. `--checkJs` does catch it (TS2440), but TypeScript is not a
  dependency of this project and adding one so a check can run is the wrong
  trade.

  So this does the one job that mattered, in plain JavaScript, with nothing to
  install: for every file, collect what it imports and what it declares at the
  top level, and complain when a name is in both. It is not a type-checker and
  is not pretending to be one — it catches exactly the mistake that got
  through, which is what a check is for.
*/
console.log("\n6. no name is both imported and declared");
{
  const before = problems;
  let files = 0;

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(js|jsx)$/.test(entry.name)) continue;
      files += 1;

      const text = decomment(readFileSync(full, "utf8"));
      const imported = new Map();   // name -> the line it arrived on

      for (const m of text.matchAll(/^import\s+([\s\S]+?)\s+from\s+["'][^"']+["']/gm)) {
        const clause = m[1];
        const line = text.slice(0, m.index).split("\n").length;

        // A default import: the bare name before any brace or comma.
        const dflt = clause.trim().match(/^([A-Za-z_$][\w$]*)/);
        if (dflt && !clause.trim().startsWith("{") && !clause.trim().startsWith("*")) {
          imported.set(dflt[1], line);
        }
        // A namespace import: * as name
        const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
        if (ns) imported.set(ns[1], line);
        // Named imports, taking whatever each was renamed to.
        const braces = clause.match(/\{([\s\S]*)\}/);
        if (braces) {
          for (const part of braces[1].split(",")) {
            const name = part.trim().split(/\s+as\s+/).pop().trim();
            if (name) imported.set(name, line);
          }
        }
      }
      if (!imported.size) continue;

      // Top-level declarations only — indented ones are inside something and
      // are allowed to shadow.
      const declared = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
      for (const m of text.matchAll(declared)) {
        const name = m[1];
        if (!imported.has(name)) continue;
        const at = text.slice(0, m.index).split("\n").length;
        bad(`${full} declares '${name}' at line ${at}, but line ${imported.get(name)} imports it`);
      }
    }
  };

  walk("src");
  if (problems === before) good(`${files} files, no name used twice`);
}

/*
  ── 7 · EVERY NAME RESOLVES ────────────────────────────────────────────────

  The check that would have caught the two worst bugs this project has had.

  Both were the same shape and neither was visible to a syntax check, because
  both were VALID JAVASCRIPT that meant nothing:

    export const listReleaseLinks = (record) =
        — a dropped arrow. Parses cleanly as an assignment to a name that does
          not exist. It only failed at runtime, on one screen.

    a component that imported Mark and also declared function Mark()
        — caught later by check 6, but only after it had broken a build.

  A parser alone cannot see either. What sees them is asking, of every
  identifier the code READS, whether anything anywhere declares it — an
  import, a parameter, a variable, a function, a catch binding. This resolves
  every scope in every file and reports the ones with no answer.

  It needs a JSX parser, which arrives with the React plugin rather than as a
  dependency of its own. If it is ever not there the check says so and stands
  down rather than failing the build over its own toolchain.
*/
console.log("\n7. every name used is declared somewhere");
{
  const before = problems;
  let parser = null, traverse = null;
  try {
    parser = await import("@babel/parser");
    const t = await import("@babel/traverse");
    traverse = t.default?.default || t.default || t;
  } catch {
    console.log("  — skipped: no JSX parser installed (npm i to restore it)");
  }

  if (parser && typeof traverse === "function") {
    const GLOBALS = new Set((
      "undefined NaN Infinity globalThis console Math JSON Object Array String Number " +
      "Boolean Date RegExp Error TypeError RangeError SyntaxError Promise Symbol Set Map " +
      "WeakMap WeakSet Proxy Reflect BigInt Intl parseInt parseFloat isNaN isFinite " +
      "encodeURIComponent decodeURIComponent encodeURI decodeURI structuredClone " +
      "queueMicrotask atob btoa TextEncoder TextDecoder Uint8Array Uint16Array Uint32Array " +
      "Int8Array Int32Array Float32Array Float64Array ArrayBuffer DataView " +
      "window document navigator location history screen self top parent frames " +
      "setTimeout clearTimeout setInterval clearInterval requestAnimationFrame " +
      "cancelAnimationFrame requestIdleCallback fetch Request Response Headers FormData " +
      "URL URLSearchParams AbortController AbortSignal Blob File FileReader Image Audio " +
      "Event CustomEvent EventTarget MessageChannel localStorage sessionStorage indexedDB " +
      "matchMedia getComputedStyle scrollTo scrollBy ResizeObserver IntersectionObserver " +
      "MutationObserver PerformanceObserver performance HTMLElement Element Node NodeList " +
      "DOMParser XMLHttpRequest WebSocket Worker crypto caches addEventListener " +
      "removeEventListener dispatchEvent postMessage close open print alert confirm prompt " +
      "process Buffer require module exports __dirname __filename createImageBitmap " +
      "ImageData OffscreenCanvas CanvasRenderingContext2D CSS WebAssembly Function eval arguments"
    ).split(/\s+/));

    let n = 0;
    for (const f of [...files, ...workerFiles]) {
      let ast;
      try {
        ast = parser.parse(read(f), { sourceType: "module", plugins: ["jsx"] });
      } catch (err) {
        bad(`${f} — will not parse: ${err.message}`);
        continue;
      }
      n++;
      const seen = new Set();
      traverse(ast, {
        ReferencedIdentifier(path) {
          const name = path.node.name;
          if (GLOBALS.has(name) || seen.has(name)) return;
          if (path.scope.hasBinding(name, true)) return;
          seen.add(name);
          bad(`${f}:${path.node.loc.start.line} — \`${name}\` is used but never declared or imported`);
        },
      });
    }
    if (problems === before) good(`${n} files, every name resolves`);
  }
}

/*
  ── 8 · EVERY WRITE CONSULTS A SESSION, OR IS ON THE LIST ──────────────────

  A route that changes something and never asks who is asking is the most
  expensive kind of mistake in this file, and it is invisible: it does not
  throw, it fails no test, and the site works perfectly until somebody finds
  it. It is also the easiest to make, because the way you make it is by adding
  a route in a hurry and not thinking about it at all.

  So the ones that genuinely are public are named below, and anything else that
  writes without reading a session is reported. Adding a public write becomes a
  deliberate act — you have to come here and say so — which is the same shape
  as PUBLIC_SETTINGS, and for the same reason.

  WHAT THIS DOES NOT PROVE. It checks that a session is CONSULTED, not that one
  is required: /polls/:id/vote reads a session to decide whether a team-only
  poll is reachable, and is public otherwise. That is correct, and this check
  cannot tell it apart from a route that reads a session and then ignores it.
  It is a smoke alarm rather than a lock — it catches the route where nobody
  thought about it at all, which is the one that actually happens.
*/
console.log("\n8. every write consults a session, or is deliberately public");
{
  const before = problems;
  const PUBLIC_WRITES = new Set([
    "/login",       // signing in is how you get a session
    "/logout",      // and out
    "/resend",      // a guest asking for their own pass again
    "/hit",         // counting a page view
    "/oops",        // a visitor's browser reporting that something broke
    "/demos",       // the public submission forms
    "/bookings",
    "/requests",
    "/songs/vote",  // the pool's ballot, one vote per browser
    "/csp",         // a browser reporting a blocked resource, sent uncredentialed
  ]);

  let parser8 = null, traverse8 = null;
  try {
    parser8 = await import("@babel/parser");
    const t = await import("@babel/traverse");
    traverse8 = t.default?.default || t.default || t;
  } catch {
    console.log("  - skipped: no parser installed (npm i to restore it)");
  }

  if (parser8 && typeof traverse8 === "function") {
    /*
      EACH FILE SEPARATELY, not the concatenation. `worker` is every worker
      file joined, which is right for the regex checks above and wrong here:
      index.js imports names core.js declares, so the joined text redeclares
      them and the parser refuses the whole thing. It did exactly that the
      moment core.js was split out.
    */
    const MUT = /method === "(POST|PATCH|PUT|DELETE)"/;
    let seen = 0;

    for (const wf of workerFiles) {
    const source = read(wf);
    const ast = parser8.parse(source, { sourceType: "module" });
    const at = (n) => source.slice(n.start, n.end);

    traverse8(ast, {
      IfStatement(path) {
        const test = at(path.node.test);
        if (!MUT.test(test)) return;
        seen++;

        // Guarded here, or by the route block enclosing this one — the content
        // and drafts routes check once for every method they answer.
        let guarded = at(path.node).includes("readSession");
        for (let p = path.parentPath; p && !guarded; p = p.parentPath) {
          if (p.isIfStatement()) guarded = at(p.node.consequent).includes("readSession");
        }
        if (guarded) return;

        const named = [...test.matchAll(/"([^"]+)"/g)].map((m) => m[1])
          .find((v) => v.startsWith("/"));
        if (named && PUBLIC_WRITES.has(named)) return;

        const line = source.slice(0, path.node.start).split("\n").length;
        bad(`${wf}:${line} writes without reading a session - ${test.replace(/\s+/g, " ").slice(0, 70)}`);
      },
    });
    }
    if (problems === before) good(`${seen} mutating routes, ${PUBLIC_WRITES.size} public on purpose`);
  }
}

/*
  ── 9 · EVERY IMPORT FINDS SOMETHING TO IMPORT ─────────────────────────────

  Check 7 proves a name is BOUND. An import binds it — so `import { getSetings }
  from "./lib/core.js"` passes check 7 perfectly while being a typo that fails
  at build and, in a worker, at runtime for every request.

  That gap did not matter while everything lived in one file. It matters now:
  splitting a module is exactly the operation that produces an import of
  something the other side does not export, and it is silent in the source.

  So this resolves every relative import between our own files and asks the
  target whether it actually exports that name. It follows re-exports one hop,
  which is as far as this codebase goes.
*/
console.log("\n9. every import resolves to a real export");
{
  const before = problems;
  let parser9 = null;
  try { parser9 = await import("@babel/parser"); }
  catch { console.log("  - skipped: no parser installed"); }

  if (parser9) {
    const EXT = ["", ".js", ".jsx", "/index.js", "/index.jsx"];
    const exportsOf = new Map();

    const readExports = (file) => {
      if (exportsOf.has(file)) return exportsOf.get(file);
      let out = new Set();
      try {
        const ast = parser9.parse(read(file), { sourceType: "module", plugins: ["jsx"] });
        for (const n of ast.program.body) {
          if (n.type === "ExportNamedDeclaration") {
            if (n.declaration) {
              if (n.declaration.declarations)
                for (const d of n.declaration.declarations) if (d.id.name) out.add(d.id.name);
              if (n.declaration.id) out.add(n.declaration.id.name);
            }
            for (const sp of n.specifiers || []) out.add(sp.exported.name);
            // `export * from "./x"` — take whatever x exports.
          } else if (n.type === "ExportAllDeclaration") {
            out.add("*");
          } else if (n.type === "ExportDefaultDeclaration") {
            out.add("default");
          }
        }
      } catch { out = null; }
      exportsOf.set(file, out);
      return out;
    };

    const resolve = (from, spec) => {
      const base = from.split("/").slice(0, -1).join("/");
      const parts = (base + "/" + spec).split("/");
      const stack = [];
      for (const seg of parts) {
        if (seg === "." || seg === "") continue;
        if (seg === "..") stack.pop();
        else stack.push(seg);
      }
      const guess = stack.join("/");
      for (const e of EXT) {
        const candidate = guess + e;
        try { readFileSync(join(ROOT, candidate), "utf8"); return candidate; } catch { /* next */ }
      }
      return null;
    };

    let n = 0;
    const all = [...files, ...workerFiles];
    for (const f of all) {
      let ast;
      try { ast = parser9.parse(read(f), { sourceType: "module", plugins: ["jsx"] }); }
      catch { continue; }

      for (const node of ast.program.body) {
        if (node.type !== "ImportDeclaration") continue;
        const spec = node.source.value;
        if (!spec.startsWith(".")) continue;          // a package, not ours
        /*
          A JSON module has a default export as far as the bundler is
          concerned, and no `export default` line to find. Asking this
          question of one produces seven confident false failures.
        */
        if (/\.(json|css|svg|png|webp|woff2?)$/.test(spec)) continue;

        const target = resolve(f, spec);
        if (!target) {
          bad(`${f} imports "${spec}" — no such file`);
          continue;
        }
        const has = readExports(target);
        if (!has || has.has("*")) continue;           // unparsable, or re-exports everything

        for (const sp of node.specifiers) {
          n++;
          if (sp.type === "ImportSpecifier") {
            if (!has.has(sp.imported.name))
              bad(`${f} imports { ${sp.imported.name} } from ${target}, which does not export it`);
          } else if (sp.type === "ImportDefaultSpecifier") {
            if (!has.has("default"))
              bad(`${f} imports a default from ${target}, which has none`);
          }
        }
      }
    }
    if (problems === before) good(`${n} imports across ${all.length} files, all resolve`);
  }
}

console.log(problems ? `\n${problems} problem(s)\n` : "\nnothing to fix\n");
process.exit(problems ? 1 : 0);
