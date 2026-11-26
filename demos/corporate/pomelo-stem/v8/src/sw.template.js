/* Pomelo STEM V8 service worker. Generated from src/sw.template.js; do not edit sw.js. */
const BUILD = __BUILD__;
const VERSION = __VERSION__;
const PREFIX = 'pomelo-v8-';
const CACHE = PREFIX + BUILD;
const PRECACHE = __PRECACHE__;
const NETWORK_ONLY = ['release.json', 'build-info.json'];

function scoped(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(scoped('build-info.json') + '?v=' + encodeURIComponent(BUILD), {cache: 'reload'});
    const info = await response.json();
    if (info.build !== BUILD) throw new Error('Build mismatch: worker ' + BUILD + ', server ' + info.build);
    const cache = await caches.open(CACHE);
    try {
      await Promise.all(PRECACHE.map(async (path) => {
        const reply = await fetch(scoped(path) + '?v=' + encodeURIComponent(BUILD), {cache: 'reload'});
        if (!reply.ok) throw new Error('Precache failed: ' + path);
        await cache.put(scoped(path), reply);
      }));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_BUILD' && event.ports[0]) event.ports[0].postMessage({build: BUILD, version: VERSION});
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !request.url.startsWith(self.registration.scope)) return;
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (NETWORK_ONLY.includes(path)) return;
  const clean = url.origin + url.pathname;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const cache = await caches.open(CACHE);
        const target = clean.endsWith('/') ? clean + 'index.html' : clean;
        return (await cache.match(target)) || (await cache.match(scoped('index.html'))) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(clean);
    if (hit) return hit;
    const isImage = request.destination === 'image' || /\.(?:webp|png|jpe?g|gif|svg|avif|ico)$/i.test(url.pathname);
    try {
      const response = await fetch(request);
      if (isImage && response.ok) {
        // Cache by clean path, just like precached assets. A full cache must not hide a successful response.
        await cache.put(clean, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      if (isImage) {
        const fallback = clean.replace(/-\d+\.webp$/, '-768.webp');
        const small = await cache.match(fallback);
        if (small) return small;
      }
      return Response.error();
    }
  })());
});
