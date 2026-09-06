/*
  Run:  npm run test:pages

  Two things that would be expensive to get wrong, checked against the real
  source rather than against a description of it.

  1. NO BUILT PAGE MAY SHADOW A REAL ROUTE. There are two defences — React
     Router matches the hand-written routes first, and the worker refuses the
     names on publish — and this checks that the worker's list actually covers
     every route the application declares. A defence that is out of date is
     worse than none, because it is trusted.

  2. THE EMBED ALLOWLIST HOLDS. A block that renders an iframe to an arbitrary
     host is the same hole as letting somebody paste HTML. This feeds it the
     things people actually paste and asserts which ones become a frame.
*/
import { readFileSync, readdirSync, statSync } from "node:fs";

const app = readFileSync("src/App.jsx", "utf8");
/*
  Every worker file joined. RESERVED_SLUGS moved into lib/core.js when the
  worker was split, and a version of this that still read index.js reported
  all twenty-two real routes as unreserved — loudly wrong, which is how a
  check should break, but wrong.
*/
const worker = readdirSync("worker")
  .flatMap((e) => (statSync("worker/" + e).isDirectory()
    ? readdirSync("worker/" + e).map((f) => "worker/" + e + "/" + f)
    : ["worker/" + e]))
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const blocks = readFileSync("src/components/Blocks.jsx", "utf8");

let bad = 0;
const check = (name, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "ok " : "✗  "} ${name}${ok || !detail ? "" : `  — ${detail}`}`);
};

console.log("\nNO BUILT PAGE CAN SHADOW A REAL ROUTE");

// every top-level path the application claims
const routes = [...app.matchAll(/<Route path="\/([^/:"]*)/g)]
  .map((m) => m[1]).filter((r) => r && r !== "*");
const unique = [...new Set(routes)];

const block = worker.slice(worker.indexOf("const RESERVED_SLUGS = new Set(["));
const reserved = new Set(
  [...block.slice(0, block.indexOf("]);")).matchAll(/"([^"]*)"/g)].map((m) => m[1])
);

for (const r of unique) {
  check(`/${r} is reserved`, reserved.has(r.toLowerCase()),
        "add it to RESERVED_SLUGS in worker/lib/core.js");
}
check("the catch-all page route is declared last",
      app.lastIndexOf('path="/:slug"') < app.lastIndexOf('path="*"'),
      "a built page would otherwise match before the 404 chain is complete");
check("every hand-written route is declared before it",
      app.lastIndexOf('path="/:slug"') > app.lastIndexOf('path="/console"'),
      "React Router matches in order — /:slug must come after the real routes");

console.log("\nTHE EMBED ALLOWLIST");

// the real function, lifted out of the module so the test cannot drift from it
const src = blocks.slice(blocks.indexOf("export function embedFor"));
const body = src.slice(0, src.indexOf("\n}\n") + 2).replace("export function", "function");
const embedFor = new Function(`${body}; return embedFor;`)();

const cases = [
  ["https://open.spotify.com/track/abc", true, "spotify"],
  ["https://soundcloud.com/artist/set", true, "soundcloud"],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", true, "youtube"],
  ["https://vimeo.com/123456789", true, "vimeo"],
  ["https://evil.example.com/player", false, "an arbitrary host"],
  ["javascript:alert(1)", false, "a javascript: url"],
  ["https://open.spotify.com.evil.com/x", false, "a lookalike hostname"],
  ["/relative/path", false, "a relative path"],
  ["https://youtube.com/watch?v=<script>", false, "a malformed video id"],
];
for (const [url, want, name] of cases) {
  check(`${want ? "embeds" : "refuses"} ${name}`, !!embedFor(url) === want, url);
}

console.log("\nNO RAW MARKUP BLOCK");
check("nothing in the kit renders unescaped HTML",
      !/dangerouslySetInnerHTML/.test(blocks),
      "a block rendering raw markup is a script tag away from running as the site");

console.log(bad ? `\n${bad} failed\n` : "\nthe builder cannot shadow a route or frame a stranger\n");
process.exit(bad ? 1 : 0);
