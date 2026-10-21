// Service Worker - Catatan Ojol PWA (Cache First Strategy)
const CACHE_NAME = 'catatan-ojol-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './app.js',
  './app-data.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn-icons-png.flaticon.com/512/1087/1087815.png'
];

// Install: Cache initial static assets & immediately activate
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use map with catch so missing optional assets don't fail installation
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((asset) =>
          cache.add(asset).catch((err) => console.warn('[SW] Failed to cache asset:', asset, err))
        )
      );
    })
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache First strategy with network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, optionally revalidate in background
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting navigation, fallback to index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
