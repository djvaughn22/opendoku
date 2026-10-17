// Face Regions offline cache: the page plus the shared kit files it loads.
// Only this game's own caches are ever cleared, so other games keep theirs.
const PREFIX = 'od-face-regions-';
const CACHE = PREFIX + 'v1';
const ASSETS = ['/face-regions/', '/kit/od.css', '/kit/photo-kit.js', '/kit/regions-engine.js', '/games.js', '/manifest.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
// network-first (fresh game when online), cache fallback offline; same-site files only
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
