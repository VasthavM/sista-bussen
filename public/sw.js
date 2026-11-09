/**
 * ZOMBUS service worker — controlled update flow (v3).
 *
 * Update protocol:
 *  - `install` precaches the app shell but NEVER calls skipWaiting(): a new worker
 *    finishes downloading and then waits quietly. The running app keeps playing.
 *  - The app pages decide when a waiting worker takes over, by posting messages:
 *      { type: 'SKIP_WAITING' }  the player accepted a restart (or a natural break hit)
 *      { type: 'CLAIM' }         first visit, page has no controller yet
 *      { type: 'QUERY_BUILD' }   reply { type: 'BUILD', build }
 *  - Activating purges every cache generation except this build's own, so a document
 *    and its hashed chunks always come from the same cache.
 *
 * `[SB_BUILD_ID]`, `[SB_BUILD_SHA]` and the asset list are substituted at build time by
 * the Vite build-id plugin (vite.config.ts). Never bump the cache by hand.
 *
 * Install precaches the shell AND every hashed asset of this build, so "download
 * complete" means the whole app is available offline and an update can never pair a new
 * document with chunks fetched later from a different deploy.
 */
const CACHE = '[SB_BUILD_ID]';
const BUILD = '[SB_BUILD_SHA]';
const ASSETS = [/*SB_PRECACHE*/];
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  ...ASSETS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const results = await Promise.allSettled(
        SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        // A failed or partial precache must not brick the app: install completes with
        // whatever succeeded, and the fetch handler falls back to the network.
        console.warn(`ZOMBUS: ${failures.length}/${SHELL.length} precache entries failed`);
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // Note: no clients.claim() here. Takeover is explicit via a CLAIM or
      // SKIP_WAITING message from the page, never a silent side effect.
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  } else if (data.type === 'CLAIM') {
    event.waitUntil(self.clients.claim());
  } else if (data.type === 'QUERY_BUILD') {
    event.source?.postMessage({ type: 'BUILD', build: BUILD });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never serve or cache worker script checks — they own their own update protocol.
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('__update-sw.js')) return;

  event.respondWith(
    (async () => {
      // ignoreVary: module scripts are CORS-mode requests and the server may answer
      // `Vary: Origin`, which would otherwise miss the precached entry offline.
      // Cache first, always scoped to this build's cache so a stale document can
      // never be paired with chunks from an unrelated build.
      let cached = null;
      try {
        cached = await caches.match(req, { cacheName: CACHE, ignoreVary: true });
      } catch {
        cached = null; // corrupt cache: fall straight through to the network
      }
      if (cached) return cached;

      let fresh;
      let fetched = false;
      try {
        const res = await fetch(req);
        fetched = true;
        if (res && res.ok && res.type === 'basic' && !url.pathname.endsWith('__update-sw.js')) {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        fresh = res;
      } catch {
        fresh = null; // network unreachable
      }

      // A real server response (even 404) passes through untouched.
      if (fetched) return fresh;

      if (req.mode === 'navigate') {
        // Offline navigation with a broken entry falls back to the shell document.
        const shell = await caches.match(new Request('./index.html'), { cacheName: CACHE, ignoreVary: true }).catch(() => null);
        if (shell) return shell;
      }
      if (fresh) return fresh;
      return new Response('ZOMBUS: offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});
