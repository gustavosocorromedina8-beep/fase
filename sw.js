// Guarda la app para que funcione sin conexión. El modelo de IA lo guarda aparte su propia librería.
importScripts('archivos.js');
const CACHE = `fase-${self.VERSION}`;
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(self.ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('fase-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
