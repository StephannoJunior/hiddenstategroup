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

const DIST = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.env.SMOKE_PORT || 8137);

const ROUTES = [
  "/", "/records", "/agency", "/artists", "/events", "/news", "/mixes",
  "/about", "/contact", "/pool", "/mypass", "/admins-staff-boss",
  "/console", "/scan", "/doorlist",
  "/this-page-does-not-exist",
];

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

  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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

    await page.close();
    if (problems.length) failures.push([route, problems]);
    console.log(`${problems.length ? "FAIL" : "  ok"}  ${route}`);
    for (const p of problems) console.log(`        ${p}`);
  }

  await browser.close();
  server.close();

  console.log(`\n${ROUTES.length - failures.length}/${ROUTES.length} pages clean`);
  if (failures.length) process.exit(1);
}

main();
