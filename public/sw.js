// Solaroid Service Worker.
//
// Strategy:
//   * Immutable Next.js build output (/_next/static/*) and app icons:
//     cache-first. These URLs are content-hashed and never change shape.
//   * Navigation requests (the HTML shell): network-first with a cache
//     fallback so the player sees new deploys, but can still boot the app
//     offline after visiting once.
//   * Everything else: pass through. The browser HTTP cache is enough.
//
// The CACHE_VERSION is bumped on incompatible sw.js changes so activate()
// can evict stale caches in one sweep.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `solaroid-static-${CACHE_VERSION}`;
const PAGE_CACHE = `solaroid-page-${CACHE_VERSION}`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  // Prime the navigation cache with the app shell so first-run offline works
  // too. Silent-fail if the network is unreachable at install time.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(PAGE_CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        // Non-fatal: the SW still installs, and cold offline just shows the
        // browser's default failure page.
      }
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("solaroid-") &&
              !name.endsWith(`-${CACHE_VERSION}`),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1) Hashed build assets + static icons → cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|ico|svg|webp|jpg|jpeg)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(STATIC_CACHE, request));
    return;
  }

  // 2) Page/document navigations → network-first.
  const accept = request.headers.get("accept") || "";
  if (request.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(networkFirst(PAGE_CACHE, request));
    return;
  }

  // 3) Everything else: let the browser handle it.
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function networkFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    const shell = await cache.match(OFFLINE_URL);
    if (shell) return shell;
    return new Response("<h1>Offline</h1>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
