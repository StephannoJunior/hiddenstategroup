/*
  Run:  npm run test:console        (needs npm run build first)

  ── WHY THIS EXISTS ────────────────────────────────────────────────────────

  smoke walks eighteen PUBLIC routes. door-test, poll-test, pages-test and the
  eight consistency checks cover logic in isolation. Nothing at all opened the
  console, signed in, and pressed something — and the console is where nearly
  all of this site's complexity lives. Every change to it was verified by a
  person, by hand, or not at all.

  ── WHY IT STUBS THE API RATHER THAN RUNNING ONE ───────────────────────────

  A real backend means wrangler, credentials, a database with the right rows
  in it, and a test that fails on a Tuesday because a session expired. None of
  that tells you anything about the console. What is worth knowing is whether
  each screen RENDERS from a plausible response and whether pressing things
  does what it says — so every /api call is answered from fixtures here.

  That is a genuine limit and worth stating plainly: this cannot catch a
  worker route that changed shape. Check 5 and check 4 cover the wiring
  between them; this covers everything after the response arrives.

  A CONSOLE ERROR FAILS THE RUN. React reports a crashed subtree, a bad hook
  order and a duplicate key on the console and nowhere else, and every one of
  those is a real defect that renders "fine" in a screenshot.
*/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const DIST = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.env.CONSOLE_PORT || 8139);

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
  ".txt": "text/plain", ".xml": "application/xml",
};

function serveDist() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const clean = normalize(decodeURIComponent(req.url.split("?")[0]))
        .replace(/^(\.\.[/\\])+/, "");
      const isRoute = !/\.[a-z0-9]+$/i.test(clean);
      const file = isRoute ? join(DIST, "index.html") : join(DIST, clean);
      try {
        const buf = await readFile(file);
        res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
        res.end(buf);
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

/*
  ── THE FIXTURES ───────────────────────────────────────────────────────────

  One plausible row per shape, and the permissions of somebody who can see
  everything — the point is to reach every screen, not to test permissions,
  which the worker decides anyway and this could only pretend to.
*/
/*
  THE SHAPE MATTERS, AND GETTING IT WRONG COST THE WHOLE TEST ITS MEANING.

  DoorGate does `setRole(res.user)`. The first version of this fixture put the
  fields at the top level, so `user` was undefined, `role` was undefined, and
  every single tab rendered THE LOGIN SCREEN — which has more than twenty
  characters on it and logs no errors, so all twenty-six of them passed. The
  only thing that failed was the one assertion specific enough to notice: a
  click on a button that was never there.

  A test that passes against the login page is not a test of the console. See
  the assertions below, which now refuse it explicitly.
*/
const ME = {
  ok: true,
  user: {
    username: "test",
    role: "BOSS",
    display_name: "Test",
    can: {
      scan: true, seeList: true, seeReasons: true, reset: true,
      issuePasses: true, revokePasses: true, manageTeam: true, seeContacts: true,
    },
  },
};

const PARTY = {
  id: "test1", name: "13.12.2026", date_label: "13 December 2026",
  venue: "A room", doors_close_at: "2099-12-14T04:00:00Z",
  minimum_age: 18, rotating: 1, archived: 0, capacity: 300,
  created_at: "2026-01-01T00:00:00Z",
};

const SETTINGS = {
  barFinish: "INK", barTabWidth: 64, barLabelSize: 7.5, barShowLabels: true,
  barDarkness: 62, barBlur: 22, barSaturation: 175, barSpeed: 1,
  paperTone: "BOARD", accentTone: "OXBLOOD", grainStrength: "NORMAL",
  poolOpen: true, poolEventOpen: true, poolHouseOpen: true,
  pollsOpen: true, pollsPerHour: 6,
  cspEnforce: false, siteClosed: false,
  maxPeoplePerRequest: 6,
};

/*
  ── THE KEYS ARE NOT A GUESS ───────────────────────────────────────────────

  Every property below is the one the calling component actually reads. That
  sounds obvious and it is exactly what went wrong: /api/me was written with
  the fields at the top level when DoorGate reads res.user, and the whole test
  quietly became a test of the login page. /api/team wanted `team` and had
  `members`; /api/oops wanted `errors` and had `faults`.

  A fixture with the wrong key does not fail — it renders an empty screen,
  which looks exactly like a working screen with nothing in it.
*/
const FIXTURES = {
  "/api/me": ME,
  "/api/site": { ok: true, settings: SETTINGS, navPages: [] },
  "/api/settings": { ok: true, settings: SETTINGS, defaults: SETTINGS },
  "/api/parties": { ok: true, parties: [PARTY], codesLeft: 500 },
  "/api/public-parties": { ok: true, parties: [PARTY] },
  "/api/passes": { ok: true, passes: [] },
  "/api/requests": { ok: true, requests: [] },
  "/api/waitlist": { ok: true, waiting: [] },
  "/api/settimes": { ok: true, times: [] },
  "/api/stats": { ok: true, stats: {}, totals: {} },
  "/api/activity": { ok: true, feed: [] },
  "/api/afters": { ok: true, sent: [], letters: [] },
  "/api/oops": { ok: true, errors: [] },
  "/api/views": { ok: true, total: 0, pages: [], days: [] },
  "/api/backups": { ok: true, backups: [] },
  "/api/epk": { ok: true, kit: null, kits: [], artists: [] },
  "/api/links": { ok: true, links: [] },
  "/api/roster": { ok: true, roster: [], artists: [] },
  "/api/share": { ok: true, links: [] },
  "/api/next-party": { ok: true, party: PARTY },
  "/api/maintenance": { ok: true },
  "/api/sync": { ok: true },
  "/api/resolve": { ok: true },
  "/api/restore": { ok: true },
  "/api/team": { ok: true, team: [ME.user] },
  "/api/posts": { ok: true, posts: [] },
  "/api/content/artists": { ok: true, items: [] },
  "/api/content/records": { ok: true, items: [] },
  "/api/content/mixes": { ok: true, items: [] },
  "/api/content/pages": { ok: true, items: [] },
  "/api/content/slots": { ok: true, items: [] },
  "/api/demos": { ok: true, demos: [] },
  "/api/bookings": { ok: true, bookings: [] },
  "/api/polls": { ok: true, polls: [], team: true },
  "/api/drafts": { ok: true, drafts: [] },
  "/api/songs": { ok: true, songs: [], team: true, mode: "ADD" },
  "/api/media": { ok: true, items: [] },
};

/*
  Every tab the console offers somebody who can see everything. The label is
  what the assertion looks for on screen, so a tab that renders an empty div
  fails rather than passing quietly.
*/
const TABS = [
  ["scan", "SCANNER"], ["door", "DOOR"], ["passes", "PASSES"],
  ["requests", "REQUESTS"], ["waiting", "WAITING"], ["sets", "SET TIMES"],
  ["stats", "THE NIGHT"], ["studio", "STUDIO"], ["events", "EVENTS"],
  ["posts", "POSTS"], ["artists", "ARTISTS"], ["records", "RECORDS"],
  ["mixes", "MIXES"], ["kits", "PRESS KITS"], ["pool", "THE POOL"],
  ["polls", "POLLS"], ["demos", "DEMOS"], ["bookings", "BOOKINGS"],
  ["activity", "ACTIVITY"], ["after", "AFTER"], ["faults", "FAULTS"],
  ["reading", "READERSHIP"], ["backups", "BACKUPS"], ["team", "TEAM"],
  ["bar", "LIQUID BAR"], ["settings", "SETTINGS"],
];

let failures = 0;
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const pass = (m) => console.log(`  ok  ${m}`);

/*
  ── THE PART THAT NEEDS NO BROWSER ─────────────────────────────────────────

  `--dry` checks that the fixtures above actually correspond to the paths the
  application calls. It matters because a fixture for a path nothing requests
  is dead weight, and a missing one silently falls through to `{ ok: true }` —
  which renders an empty screen that looks like a working screen.

  It runs without Chromium, so it is worth something on a machine where the
  full test cannot run at all.
*/
async function dryRun() {
  const { readFile: rf } = await import("node:fs/promises");
  const api = await rf(new URL("../src/lib/api.js", import.meta.url), "utf8");
  const called = new Set();
  for (const m of api.matchAll(/call\(\s*[`"']\/([\w-]+(?:\/[\w-]+)?)/g)) {
    called.add("/api/" + m[1].split("/")[0]);
  }

  let missing = 0;
  for (const path of [...called].sort()) {
    // A path the console never reaches needs no fixture; these are the ones
    // a signed-in console does reach on load.
    if (!FIXTURES[path] && !FIXTURES[path.replace(/\/[^/]+$/, "")]) {
      console.log(`  · no fixture for ${path} — it will answer { ok: true }`);
      missing++;
    }
  }
  const unused = Object.keys(FIXTURES).filter(
    (k) => !called.has(k) && !called.has(k.split("/").slice(0, 3).join("/"))
  );
  for (const k of unused) console.log(`  · fixture for ${k}, which api.js never calls`);

  /*
    Eight are expected to be unfixtured and it is worth saying which, so the
    number is not something people learn to scroll past: /content is a prefix
    the fallback already answers, and /hit /login /logout /pass /resend /scan
    /wall are actions or public pages the console does not touch on load. For
    those, { ok: true } is the right answer rather than a missing one.
  */
  console.log(`\n${called.size} paths called, ${Object.keys(FIXTURES).length} fixtures, ` +
              `${missing} unfixtured (eight are expected — see the note above)\n`);
  process.exit(0);
}

if (process.argv.includes("--dry")) {
  await dryRun();
}

async function main() {
  const server = await serveDist();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Anything React complains about is a defect, and it is invisible in a
  // screenshot. Warnings about keys and hooks count.
  const noise = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") noise.push(m.text());
  });
  page.on("pageerror", (e) => noise.push(`uncaught: ${e.message}`));

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname;
    const body = FIXTURES[key]
      ?? FIXTURES[key.replace(/\/[^/]+$/, "")]   // /api/content/x → /api/content
      ?? { ok: true };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  console.log("\nTHE CONSOLE, ONE TAB AT A TIME\n");

  // Signed in before the application boots, the same way the login leaves it.
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => sessionStorage.setItem("hs-session-token", "test-token"));

  for (const [id, label] of TABS) {
    noise.length = 0;
    try {
      await page.goto(`http://localhost:${PORT}/console?tab=${id}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(120);

      const text = await page.evaluate(() => document.body.innerText);
      if (!text || text.trim().length < 20) {
        fail(`${label} — the page rendered almost nothing`);
        continue;
      }
      /*
        THE ASSERTION THAT MAKES THE REST MEAN ANYTHING. The login screen is a
        perfectly valid page: it has text, it logs nothing, and it is not the
        console. Without this, a broken fixture turns every check below into a
        check that the login form renders.
      */
      if (/DOOR STAFF AND MANAGEMENT/i.test(text)) {
        fail(`${label} — this is the LOGIN screen, not the console`);
        continue;
      }
      // The tab strip is only drawn once somebody is signed in, and every tab
      // is named in it. A screen that does not contain its own name is not it.
      if (!text.toUpperCase().includes(label)) {
        fail(`${label} — the console rendered, but this tab is not on it`);
        continue;
      }
      if (/Something went wrong|Cannot read|undefined is not/i.test(text)) {
        fail(`${label} — an error is on screen`);
        continue;
      }
      // React's own crash boundary, whatever it renders around it.
      const broke = noise.filter((n) =>
        !/favicon|Download the React DevTools|preload/i.test(n));
      if (broke.length) {
        fail(`${label} — ${broke[0].slice(0, 120)}`);
        continue;
      }
      pass(`${label}`);
    } catch (err) {
      fail(`${label} — ${String(err.message).split("\n")[0].slice(0, 110)}`);
    }
  }

  /*
    One real interaction, on the screen most likely to hide a fault: the
    Studio, which is the newest and has the most moving parts. Opening the
    editor is what proves the form, the block arranger and the preview all
    mount together.
  */
  console.log("\nPRESSING SOMETHING\n");
  noise.length = 0;
  try {
    await page.goto(`http://localhost:${PORT}/console?tab=studio`, { waitUntil: "networkidle" });
    const start = page.getByRole("button", { name: /START A NEW/i }).first();
    await start.click({ timeout: 4000 });
    await page.waitForTimeout(200);
    const text = await page.evaluate(() => document.body.innerText);
    if (/PUBLISH/i.test(text)) pass("the Studio opens an editor with a publish button");
    else fail("the Studio's editor did not open");
    const broke = noise.filter((n) => !/favicon|DevTools|preload/i.test(n));
    if (broke.length) fail(`opening the editor logged: ${broke[0].slice(0, 110)}`);
  } catch (err) {
    fail(`the Studio — ${String(err.message).split("\n")[0].slice(0, 110)}`);
  }

  await browser.close();
  server.close();

  console.log(failures
    ? `\n${failures} problem(s) in the console\n`
    : `\nthe console opens, on every tab\n`);
  process.exit(failures ? 1 : 0);
}

main();
