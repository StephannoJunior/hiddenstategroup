/*
  Service worker — makes the site load fast on repeat visits and open at all
  with no signal.

  Strategy, kept deliberately simple:
    • Pages  → try the network first, fall back to the cache. This means
      visitors always get the newest content when they have signal, and still
      see something when they don't.
    • Assets → serve from cache first, since images and scripts carry a hash in
      their filename and never change once built.

  Bump CACHE_VERSION whenever you want returning visitors to drop their old
  cache; the build hashes assets anyway, so this is rarely needed.
*/

const CACHE_VERSION = "hidden-state-v1";
const OFFLINE_URL = "/";

const PRECACHE = [
  "/",
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
      .catch(() => self.skipWaiting()) // a failed precache must not block install
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle our own GET requests. Form posts, Formspree, YouTube, Dropbox
  // and Mixcloud all go straight to the network untouched.
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  const isPage = request.mode === "navigate";

  if (isPage) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL)))
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
