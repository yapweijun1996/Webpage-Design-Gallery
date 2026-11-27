/* Pomelo STEM V8 service worker. Generated from src/sw.template.js; do not edit sw.js. */
const BUILD = "20261127.6";
const VERSION = "8.3.0";
const PREFIX = 'pomelo-v8-';
const CACHE = PREFIX + BUILD;
const PRECACHE = [
  "about.html",
  "assets/css/site.bundle.css",
  "assets/img/a01-home-hero-merchant-768.webp",
  "assets/img/a02-story-customer-sees-768.webp",
  "assets/img/a03-story-order-packed-768.webp",
  "assets/img/a04-story-studio-prep-768.webp",
  "assets/img/a05-story-ai-photo-768.webp",
  "assets/img/a06-product-mug-768.webp",
  "assets/img/a07-product-bowl-768.webp",
  "assets/img/a08-product-basket-768.webp",
  "assets/img/a09-commerce-pickup-768.webp",
  "assets/img/a10-services-dark-band-768.webp",
  "assets/img/a11-about-team-768.webp",
  "assets/img/a12-contact-desk-768.webp",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
  "assets/img/icon-maskable-512.png",
  "assets/img/pomelo-mark.svg",
  "assets/js/components/accordion.js",
  "assets/js/components/back-to-top.js",
  "assets/js/components/commerce-demo.js",
  "assets/js/components/contact-form.js",
  "assets/js/components/demo-note.js",
  "assets/js/components/header.js",
  "assets/js/components/lang-menu.js",
  "assets/js/components/motion.js",
  "assets/js/components/review.js",
  "assets/js/components/tabs.js",
  "assets/js/core/dialog.js",
  "assets/js/core/i18n.js",
  "assets/js/core/loader-boot.js",
  "assets/js/core/loader.js",
  "assets/js/core/reload.js",
  "assets/js/core/sw-register.js",
  "assets/js/core/theme.js",
  "assets/js/core/toast.js",
  "assets/js/core/unsaved.js",
  "assets/js/core/update.js",
  "assets/js/i18n-defaults.generated.js",
  "assets/js/icons.generated.js",
  "assets/js/main.js",
  "assets/js/store/demo-store.js",
  "commerce.html",
  "contact.html",
  "how-it-works.html",
  "index.html",
  "manifest.webmanifest",
  "ms/about.html",
  "ms/commerce.html",
  "ms/contact.html",
  "ms/how-it-works.html",
  "ms/index.html",
  "ms/services.html",
  "services.html",
  "zh/about.html",
  "zh/commerce.html",
  "zh/contact.html",
  "zh/how-it-works.html",
  "zh/index.html",
  "zh/services.html"
];
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
