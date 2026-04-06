const CACHE_NAME = '10009SIM-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/store.js',
  './js/api.js',
  './js/dice.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    // 네트워크에서 먼저 최신 파일을 가져오고, 오프라인이거나 에러 나면 캐시를 보여줌 (Network First)
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});
