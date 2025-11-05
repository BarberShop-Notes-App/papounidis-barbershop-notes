/* Minimal cache-first Service Worker for app shell */
const CACHE_NAME = "papounidis-shell-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/photos/background.JPG",
];

self.addEventListener("install", (evt) => {
  self.skipWaiting();
  evt.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) =>
            k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()
          )
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  if (req.method !== "GET") return;
  // navigation fallback
  if (req.mode === "navigate") {
    evt.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }
  // cache-first for known assets
  const url = new URL(req.url);
  if (ASSETS.includes(url.pathname) || ASSETS.includes(url.pathname + "/")) {
    evt.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              if (!res || res.status !== 200) return res;
              const r = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, r));
              return res;
            })
            .catch(() => caches.match("/index.html"))
      )
    );
    return;
  }

  // network-first otherwise with cache fallback
  evt.respondWith(
    fetch(req)
      .then((res) => res)
      .catch(() => caches.match(req))
  );
});
