/*
 * Career Desk service worker.
 *
 * Caching rules (deliberately strict, this is a private authenticated app):
 * - Precached: the offline fallback, the manifest and static icons only.
 * - Runtime-cached: content-hashed Next.js static assets and /icons/.
 * - NEVER cached: navigations, /api/*, and all cross-origin requests
 *   (which includes everything on the Supabase domain). Authenticated
 *   responses must never come from a cache.
 */

const PRECACHE = "careerdesk-precache-v1";
const RUNTIME = "careerdesk-runtime-v1";

const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin traffic: Supabase, DeepSeek, anything else.
  if (url.origin !== self.location.origin) return;

  // Never cache app API routes.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first. Offline? serve cache, else the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline");
        }),
    );
    return;
  }

  // Content-hashed static assets and icons: cache first.
  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/");

  if (cacheable) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Everything else (pages, RSC payloads, Supabase JS fetches on this origin):
  // straight to the network, never stored.
});
