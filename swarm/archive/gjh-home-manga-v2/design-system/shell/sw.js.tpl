'use strict';

const CACHE_NAME = __CACHE_NAME__;
const PRECACHE = __PRECACHE__;
const SCOPE = new URL(self.registration.scope);
const ASSETS = new Set(PRECACHE.map(file => new URL(file, SCOPE).href));
const INDEX = new URL('index.html', SCOPE).href;
const OFFLINE = new URL('offline.html', SCOPE).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    Array.from(ASSETS, url => new Request(url, { cache: 'reload' })),
  )));
});

async function removeOldCaches() {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith('sds-') && name !== CACHE_NAME).map(async name => {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    if (!requests.some(request => request.url === INDEX)) return;
    const otherScopes = requests.filter(request => request.url !== INDEX && new URL(request.url).pathname.endsWith('/index.html'))
      .map(request => new URL('./', request.url).href);
    // An identical export can share a cache with another install on the same origin.
    if (otherScopes.length === 0) {
      await caches.delete(name);
      return;
    }
    const nestedScopes = otherScopes.filter(scope => scope.startsWith(SCOPE.href));
    const outdated = requests.filter(request => request.url.startsWith(SCOPE.href) &&
      !nestedScopes.some(scope => request.url.startsWith(scope)));
    await Promise.all(outdated.map(request => cache.delete(request)));
  }));
}

self.addEventListener('activate', event => {
  event.waitUntil(removeOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

async function respond(request, asset) {
  const cache = await caches.open(CACHE_NAME);
  const cached = asset && await cache.match(asset);
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (error) {
    if (request.mode !== 'navigate') throw error;
    return await cache.match(OFFLINE) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  url.search = '';
  url.hash = '';
  const key = url.href === SCOPE.href ? INDEX : url.href;
  const asset = ASSETS.has(key) ? key : null;
  if (asset || request.mode === 'navigate') event.respondWith(respond(request, asset));
});
