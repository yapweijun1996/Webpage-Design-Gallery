// Embedded in each worker so its lifecycle and cache stay within its registration.
async function verifyResponse(response, {path, sha256}) {
  if (response?.status !== 200 || response.redirected) throw new Error('Unavailable resource: ' + path);
  const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if ((path.endsWith('.css') && type !== 'text/css') ||
      (path.endsWith('.js') && !/^(?:text|application)\/(?:x-)?(?:java|ecma)script$/.test(type))) {
    throw new Error('Unexpected resource type: ' + path);
  }
  const bytes = await response.clone().arrayBuffer();
  if (!bytes.byteLength) throw new Error('Empty resource: ' + path);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error('Integrity check failed: ' + path);
  return response;
}

async function cachedResource(entry, cacheName) {
  if (!entry) return;
  try {
    const response = await caches.match(new URL(entry.path, BASE), {cacheName});
    return await verifyResponse(response, entry);
  } catch { /* A missing, unreadable or invalid entry can be fetched again. */ }
}

async function fetchResource(entry, build) {
  const url = new URL(entry.path, BASE);
  url.searchParams.set('v', build);
  const response = await fetch(url, {cache: 'reload', credentials: 'omit', redirect: 'error'});
  return verifyResponse(response, entry);
}

async function precachedResource(entry, cacheName, build) {
  const cached = await cachedResource(entry, cacheName);
  if (cached) return cached;
  const response = await fetchResource(entry, build);
  try {
    const cache = await caches.open(cacheName);
    await cache.put(new URL(entry.path, BASE), response.clone());
  } catch { /* A verified network response is usable even if storage is unavailable. */ }
  return response;
}

async function preparePrecache(entries, cacheName, build, repair = false) {
  const cache = await caches.open(cacheName);
  // Bound memory and let every in-flight write settle before install cleanup.
  for (let offset = 0; offset < entries.length; offset += 6) {
    const results = await Promise.allSettled(entries.slice(offset, offset + 6).map(async entry => {
      if (repair && await cachedResource(entry, cacheName)) return;
      await cache.put(new URL(entry.path, BASE), await fetchResource(entry, build));
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  // Read from storage again: a successful download alone does not verify the saved release.
  for (const entry of entries) {
    if (!await cachedResource(entry, cacheName)) throw new Error('Incomplete precache: ' + entry.path);
  }
}

async function activateVerified(entries, cacheName, build, port) {
  try {
    // Entries may be evicted while a fully installed worker waits for consent.
    await preparePrecache(entries, cacheName, build, true);
    await self.skipWaiting();
  } catch {
    port?.postMessage({type: 'UPDATE_FAILED'});
  }
}

function offlinePage() {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connection needed</title><h1>Reconnect to continue</h1><p>Reload this page when you are back online.</p>',
    {headers: {'Content-Type': 'text/html; charset=utf-8'}});
}
