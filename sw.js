// Работа без интернета: сначала берём свежую версию из сети, если сети нет — сохранённую копию.
const CACHE = 'my-day-v9';
const FILES = ['./', 'index.html', 'fin.js', 'extra.js', 'sync.js', 'select.js', 'manifest.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  // свои файлы всегда сверяем с сайтом, чтобы обновления приходили сразу
  const own = new URL(e.request.url).origin === self.location.origin;
  // (по адресу, а не по самому запросу: запрос страницы нельзя пересобрать с другими настройками)
  e.respondWith(fetch(own ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request)
    .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
