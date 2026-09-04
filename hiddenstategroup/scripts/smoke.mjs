/*
  THE SMOKE TEST — open every page and fail on anything the browser complains
  about.

  WHY IT EXISTS. Three separate bugs reached the live site in one day: a
  duplicate declaration that broke the build, a component used without being
  imported, and a stylesheet rule that put a black strip above every hero. All
  three would have been caught by loading the page once and reading the
  console. Nothing was loading the page once.

  WHAT COUNTS AS A FAILURE.  A console error, an uncaught exception, a request
  that 404s, or a page whose root element is still empty after it settles —
  which is what a crashed React tree looks like from outside.

  WHAT IT DELIBERATELY IGNORES.  Anything from the service worker (it is not
  registered in a fresh profile and its warnings are noise), and failed calls
  to /api, because there is no server behind a static dist. A page that
  handles its own API failure gracefully is a page working correctly.

  Run:  npm run build && npm run smoke
*/
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.env.SMOKE_PORT || 8137);

const ROUTES = [
  "/", "/records", "/agency", "/artists", "/events", "/news", "/mixes",
  "/about", "/contact", "/pool", "/mypass", "/admins-staff-boss",
  "/console", "/scan", "/doorlist",
  "/demos", "/bookings",
  "/this-page-does-not-exist",
];

/*
  ── U02 · PICTURES IN THE TEST ─────────────────────────────────────────────

  Until now this knew whether a page LOADED. It had no idea whether the page
  looked right, which is why the glass bar broke twice without anything here
  failing: no console error, no exception, no 404 — just a selection capsule
  inflating in the wrong place.

  So every route is also photographed and compared against the last accepted
  picture. Nothing here decides what "correct" looks like; it reports what
  CHANGED, and a person decides.

  THE MECHANICS THAT MAKE IT USABLE RATHER THAN INFURIATING:

    · A FIXED VIEWPORT AND deviceScaleFactor 1, so a different machine does
      not report every page as changed.
    · ANIMATIONS DISABLED at the CSS level before the shot. The bar's springs
      settle over about half a second and a shot taken mid-settle differs from
      itself run to run. A test that fails at random is a test people learn to
      ignore, and then it is worth less than nothing.
    · A TOLERANCE. Font rasterisation differs by a pixel or two between
      machines; below 0.4% of pixels changed is not a change.
    · IT DOES NOT FAIL THE BUILD. A visual difference is usually a change you
      meant to make, and a check that blocks every deliberate redesign gets
      switched off within a week. It prints what moved and writes the new shot
      beside the old one so you can look.

  Baselines live in tests/shots/ and are committed. Accept new ones with
  `npm run smoke -- --bless`, which is a thing you do on purpose after looking.
*/
const SHOTS = new URL("../tests/shots/", import.meta.url).pathname;
const BLESS = process.argv.includes("--bless");
const TOLERANCE = 0.004;

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
  ".txt": "text/plain", ".xml": "application/xml",
};

/*
  A single-page app needs the same index.html for every unknown path, exactly
  as the Worker's not_found_handling does in production. Serving a 404 here
  instead would make every route in the list fail for the wrong reason.
*/
function serveDist() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const clean = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
      /*
        A path with no file extension is a ROUTE, and always gets index.html.
        Checking the disk first looked more careful and was wrong: /records
        and /artists are also folders inside public/, so the disk answered
        "that is a directory" and the test 404'd on four real pages.
      */
      const isRoute = !/\.[a-z0-9]+$/i.test(clean);
      let file = isRoute ? join(DIST, "index.html") : join(DIST, clean);
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

const ignorable = (text) =>
  /serviceWorker|ServiceWorker|sw\.js|\/api\/|fonts\.googleapis|fonts\.gstatic|net::ERR_FAILED|Failed to load resource/.test(text);

async function main() {
  const server = await serveDist();
  const browser = await chromium.launch();
  const failures = [];
  const shots = [];

  for (const route of ROUTES) {
    /*
      A FIXED SCALE as well as a fixed size. Playwright defaults to the host's
      device pixel ratio, so the same page photographed on a retina Mac and on
      GitHub's Linux runners is two different images and every route reports
      as changed forever.
    */
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    const problems = [];

    /*
      Nothing off this machine. A test that waits on a font CDN either hangs
      or fails on somebody else's bad afternoon. Blocking outside requests
      also proves the pages render with the typefaces missing, which is the
      state every first-time visitor is in for a few hundred milliseconds.

      The API is answered with an empty but well-formed body, so each page
      renders its EMPTY state. Without that, every page that loads data sits
      in its loading state forever and the test calls it blank — which is how
      the first run reported ten failures that were all one missing server.
    */
    await page.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") return route.abort();
      if (u.pathname.startsWith("/api/")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true, user: null, team: false, settings: {},
            parties: [], songs: [], posts: [], items: [], passes: [],
            people: [], files: [], pages: [], daily: [], total: 0,
          }),
        });
      }
      return route.continue();
    });

    page.on("console", (m) => {
      if (m.type() === "error" && !ignorable(m.text())) problems.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`threw: ${e.message}`));
    page.on("response", (r) => {
      if (r.status() >= 400 && !ignorable(r.url())) problems.push(`${r.status()} ${r.url()}`);
    });

    try {
      await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "load", timeout: 15000 });
      /*
        Read through document.body, not a locator on #root. Every page puts
        the floating bar in fixed position, which can leave #root with no
        layout box — and a locator reading a box with no height reports no
        text at all. Three good pages were called blank that way.

        One retry, because a page is allowed to navigate once: the service
        worker taking control reloads it, and an evaluate caught mid-reload
        throws. Two navigations in a row is a redirect loop and still fails.
      */
      const settled = () =>
        page.evaluate(() => (document.body.innerText || "").trim().length);
      await page.waitForFunction(
        () => (document.body.innerText || "").trim().length > 120,
        null, { timeout: 8000 }
      ).catch(() => {});

      let len = await settled().catch(() => -1);
      if (len < 0) {
        await page.waitForTimeout(1200);
        len = await settled().catch(() => 0);
      }
      if (len < 120) problems.push(`renders nothing (${len} chars of text)`);
    } catch (e) {
      problems.push(`did not load: ${e.message.split("\n")[0]}`);
    }

    /*
      The picture. Taken last, after the page has settled, and never allowed
      to fail the route it is photographing — a screenshot that throws must
      not turn a working page into a failing test.
    */
    try {
      const shot = await capture(page, route);
      if (shot) shots.push(shot);
    } catch (e) {
      shots.push({ route, note: `could not photograph: ${e.message.split("\n")[0]}` });
    }

    await page.close();
    if (problems.length) failures.push([route, problems]);
    console.log(`${problems.length ? "FAIL" : "  ok"}  ${route}`);
    for (const p of problems) console.log(`        ${p}`);
  }

  await browser.close();
  server.close();

  console.log(`\n${ROUTES.length - failures.length}/${ROUTES.length} pages clean`);

  // ── what the pictures say ────────────────────────────────────────────────
  const fresh = shots.filter((s) => s.state === "new");
  const moved = shots.filter((s) => s.state === "changed");
  const noted = shots.filter((s) => s.note);

  if (BLESS) {
    console.log(`\n${shots.length} pictures accepted as the new baseline.`);
  } else if (fresh.length || moved.length || noted.length) {
    console.log("");
    for (const s of fresh) console.log(`  new   ${s.route} — no picture to compare against yet`);
    for (const s of moved) {
      console.log(`  MOVED ${s.route} — ${(s.share * 100).toFixed(1)}% of pixels differ`);
      console.log(`        ${path.relative(process.cwd(), s.now)}`);
    }
    for (const s of noted) console.log(`  ?     ${s.route} — ${s.note}`);
    if (moved.length) {
      console.log("\n  Look at those, then either fix them or run:");
      console.log("      npm run smoke -- --bless");
      console.log("  A difference is usually one you meant. This never fails the build.");
    }
  } else if (shots.length) {
    console.log(`${shots.length}/${shots.length} pages look the same as last time`);
  }

  if (failures.length) process.exit(1);
}

/*
  ── PHOTOGRAPHING A PAGE ───────────────────────────────────────────────────

  Comparison is done on the raw PNG bytes decoded to pixels by the browser
  itself rather than by an image library: adding a dependency to this project
  currently means a 403 from the registry, and Chromium is already here and
  already knows how to decode a PNG. It reads both images into a canvas and
  counts pixels that differ by more than a whisker.
*/
async function capture(page, route) {
  const name = (route === "/" ? "home" : route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")) + ".png";
  const baseline = path.join(SHOTS, name);
  const current = path.join(SHOTS, name.replace(/\.png$/, ".now.png"));

  // Nothing moving. Springs, transitions, the developing photographs — all of
  // it settles to the same place, and a shot taken on the way there does not.
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-duration: 0s !important; animation-delay: 0s !important;
      transition-duration: 0s !important; transition-delay: 0s !important;
    }
    html { scroll-behavior: auto !important; }
  ` }).catch(() => {});
  await page.waitForTimeout(400);

  const buf = await page.screenshot({ fullPage: false });

  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  if (BLESS || !fs.existsSync(baseline)) {
    fs.writeFileSync(baseline, buf);
    if (fs.existsSync(current)) fs.unlinkSync(current);
    return { route, state: BLESS ? "blessed" : "new" };
  }

  const share = await comparePngs(page, fs.readFileSync(baseline), buf);
  if (share === null) return { route, note: "could not compare the two pictures" };

  if (share > TOLERANCE) {
    fs.writeFileSync(current, buf);
    return { route, state: "changed", share, now: current };
  }
  if (fs.existsSync(current)) fs.unlinkSync(current);
  return { route, state: "same", share };
}

async function comparePngs(page, aBuf, bBuf) {
  const a = "data:image/png;base64," + aBuf.toString("base64");
  const b = "data:image/png;base64," + bBuf.toString("base64");
  return page.evaluate(async ([sa, sb]) => {
    const load = (src) => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    try {
      const [ia, ib] = await Promise.all([load(sa), load(sb)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const draw = (img) => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        c.getContext("2d").drawImage(img, 0, 0);
        return c.getContext("2d").getImageData(0, 0, img.width, img.height).data;
      };
      const da = draw(ia), db = draw(ib);
      let off = 0;
      // A whisker of 12 per channel: below that is rasterisation, not design.
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) > 12 ||
            Math.abs(da[i + 1] - db[i + 1]) > 12 ||
            Math.abs(da[i + 2] - db[i + 2]) > 12) off++;
      }
      return off / (da.length / 4);
    } catch {
      return null;
    }
  }, [a, b]);
}

main();
