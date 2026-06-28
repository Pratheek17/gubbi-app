// Gubbi service worker — offline support via stale-while-revalidate.
// Bump CACHE_NAME on every deploy so clients drop the previous build's assets.
const CACHE_NAME = 'gubbi-v3';

self.addEventListener('install', () => {
  // Activate this SW immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle http(s) GETs on this origin (app shell + bundled assets + the
  // same-origin gubbi-content). chrome-extension:// and the like are ignored.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          // Only cache complete, OK, same-origin responses.
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      // Serve cache instantly if present; always refresh in the background.
      return cached || network;
    })()
  );
});
