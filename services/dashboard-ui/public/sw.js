// JalRakshak Progressive Web App Service Worker
const CACHE_NAME = 'jalrakshak-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let browser fetch normally, fallback if network fails
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
