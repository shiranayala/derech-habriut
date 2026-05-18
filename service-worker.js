const CACHE = 'derech-habriut-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/logic.js',
  './js/app.js',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only handle GET requests for same-origin or Google Fonts
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isFont = url.hostname.includes('fonts.googleapis.com') ||
                 url.hostname.includes('fonts.gstatic.com');
  const isLocal = url.origin === self.location.origin;

  if (!isLocal && !isFont) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
