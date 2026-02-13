const CACHE_NAME = 'beads-designer-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/script.js',
  '/styles.css',
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // 👉 só intercepta GET
  if (event.request.method !== 'GET') return;

  // 👉 não intercepta navegação de documento
  if (event.request.mode === 'navigate') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});


// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    )
  );
});
