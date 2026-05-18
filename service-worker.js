// ─── Cache version ────────────────────────────────────────────────────────────
// Bump CACHE_VERSION on every deploy to invalidate all cached assets.
const CACHE_VERSION = 'v2';
const CACHE = `derech-habriut-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/logic.js',
  './js/app.js',
  './icons/icon-512.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      // Notify all open tabs that a new version is active
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isFont   = url.hostname.includes('fonts.googleapis.com') ||
                   url.hostname.includes('fonts.gstatic.com');
  const isImage  = /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname);
  const isLocal  = url.origin === self.location.origin;

  if (!isLocal && !isFont) return;

  if (isFont || isImage) {
    // Cache-first: fast, these assets rarely change
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML / JS / CSS: always try to get the latest version
  e.respondWith(
    fetch(e.request).then(response => {
      if (!response || response.status !== 200) return response;
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, clone));
      return response;
    }).catch(() =>
      caches.match(e.request).then(cached =>
        cached || (e.request.mode === 'navigate' ? caches.match('./index.html') : null)
      )
    )
  );
});
