/*
  Service worker — makes the site fast, work offline, and update itself.

  UPDATING. This is the part that matters for a site that changes often.
  By default a new service worker installs but then WAITS until every tab
  using the old one is closed. On a phone home screen that can be days, so
  people would keep seeing an old version long after you published.

  Three things prevent that here:
    1. skipWaiting()  — the new worker takes over immediately
    2. clients.claim() — it takes control of open pages straight away
    3. the page listens for that handover and reloads itself once

  Result: publish a change, and anyone with the app installed gets it the
  next time they open or return to it, without doing anything.

  STRATEGY
    Pages  → network first, cache as fallback. Always the newest content
             when there is signal, still readable when there is none.
    Assets → cache first. Vite puts a content hash in every filename, so a
             changed file is a NEW filename and can never be served stale.
*/

// BUMP THIS whenever you want every visitor to drop their cached copies.
// You rarely need to: Vite already fingerprints JS and CSS filenames, so a
// changed file is automatically a new file. This is for the rare case of
// clearing something stubborn.
const CACHE_VERSION = "hidden-state-v5";
const OFFLINE_URL = "/";

const PRECACHE = [
  "/",
  "/mypass",
  "/manifest.webmanifest",
  "/icons/icon-192.jpg",
  "/icons/apple-touch-icon.jpg",
  "/wordmark-black.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from a previous version.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));

      // Use navigation preload where available — the browser starts fetching
      // the page while the worker is still waking up, which removes the small
      // delay a service worker otherwise adds to the first load.
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch { /* not supported */ }
      }

      await self.clients.claim();
    })()
  );
});

// Lets the page ask the worker to hand over immediately.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  const target = new URL(request.url);

  /*
    THE TYPEFACES.

    These are the one thing worth keeping from another origin. Without this
    the installed app opens offline set in Georgia — the layout holds, but it
    stops looking like the site. Cache-first with a background refresh: a
    served font is instant, and a new weight still arrives on the next visit.

    Google serves the stylesheet with a short cache life and the font files
    with a year, so the stylesheet is the one that needs revalidating.
  */
  if (target.hostname === "fonts.googleapis.com" || target.hostname === "fonts.gstatic.com") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const hit = await cache.match(request);
        const live = fetch(request)
          .then((res) => {
            // Opaque cross-origin responses are cacheable and perfectly
            // usable for fonts; only genuine failures are skipped.
            if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        return hit || (await live) || Response.error();
      })()
    );
    return;
  }

  if (target.origin !== self.location.origin) return;

  /*
    Never touch the API. A cached /api/ response is worse than no response:
    the door would keep showing a guest list from an hour ago, and a page
    loaded from cache would look like the API is missing entirely. These
    always go straight to the network.
  */
  /*
    ── G02 · A PASS THAT WORKS WITH NO SIGNAL ──────────────────────────────

    The API is otherwise never cached, and that rule is right: a cached guest
    list at a door would show who was admitted an hour ago and call it now.

    ONE EXCEPTION — a guest's own pass. It is the one API answer where being
    slightly old is far better than being absent, because the alternative is
    somebody standing outside with a white screen. One bar of reception is
    worse than none: the request hangs rather than failing, and network-first
    means watching it hang.

    So a pass is served from the phone INSTANTLY and refreshed in the
    background. Two things make that safe:

      · the rotating number still needs the network, and the page says so
      · THE DOOR IS THE AUTHORITY, not this page. A pass cancelled since it
        was cached still shows here and is still refused at the door, because
        the scanner asks the server every time. This page is a convenience;
        it was never the check.
  */
  const isOwnPass = /^\/api\/pass\/[^/]+$/.test(target.pathname);

  if (target.pathname.startsWith("/api/") && !isOwnPass) return;

  if (isOwnPass) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const hit = await cache.match(request);
        const live = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        // Cached first when there is one, and the network only when there is
        // not — which is what makes it instant on a bad connection instead of
        // merely survivable on none.
        return hit || (await live) || Response.error();
      })()
    );
    return;
  }

  /*
    The pass PAGE, as well as its data. A guest whose phone has the answer
    but not the page to show it in is no better off.
  */
  if (request.mode === "navigate" && /^\/pass\//.test(target.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const hit = await cache.match(request);
        const live = fetch(request)
          .then((res) => { if (res && res.ok) cache.put(request, res.clone()); return res; })
          .catch(() => null);
        return hit || (await live) || (await caches.match(OFFLINE_URL)) || Response.error();
      })()
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, preload.clone());
            return preload;
          }
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(request)) || (await caches.match(OFFLINE_URL));
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});
