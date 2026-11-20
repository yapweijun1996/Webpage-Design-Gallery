import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const version = '2.0.0';
const build = 'new';
const assets = {
  'index.html': ['<h1>Saved shell</h1>', 'text/html'],
  'offline.html': ['<h1>Reconnect screen</h1>', 'text/html'],
  'style.bundle.css': ['body { color: red; }', 'text/css']
};
const manifest = Object.entries(assets).map(([path, [body]]) =>
  ({path, sha256: createHash('sha256').update(body).digest('hex')}));
const variants = {
  'gjh-v11-sw': ['demos/corporate/gjh/v11/', 'gjh-v11:', ':offline:'],
  'demo-sw': ['demos/corporate/gjh/v12/', 'wdg:demo:', ':'],
  sw: ['', 'wdg:', ':shell:']
};

function fixture(template) {
  const [directory, prefix, suffix] = variants[template];
  const base = new URL(directory, 'https://example.test/gallery/');
  const cachePrefix = prefix + base.pathname + suffix;
  const cacheName = cachePrefix + build;
  const oldName = cachePrefix + 'old';
  const key = path => new URL(path, base).href;
  const files = new Map([[oldName, new Map([[key('index.html'), new Response('previous shell')]])]]);
  const listeners = {};
  const fetched = [];
  let skipCount = 0;
  let networkDown = false;
  let errorFor;
  let missOnRead;
  let failOpen = false;
  const caches = {
    async match(url, {cacheName}) {
      if (url.href === missOnRead) return undefined;
      return files.get(cacheName)?.get(url.href)?.clone();
    },
    async open(name) {
      if (failOpen) throw new Error('Storage is unavailable');
      if (!files.has(name)) files.set(name, new Map());
      const cache = files.get(name);
      return {put: async (url, response) => { cache.set(url.href, response.clone()); }};
    },
    async delete(name) { return files.delete(name); },
    async keys() { return [...files.keys()]; }
  };
  const readTemplate = name => readFileSync(new URL('../templates/gallery/' + name + '.js', import.meta.url), 'utf8');
  const script = readTemplate(template)
    .replace('__BUILD__', JSON.stringify(build))
    .replace('__VERSION__', JSON.stringify(version))
    .replace('__PRECACHE__', JSON.stringify(manifest))
    .replace('__LAZY_ASSETS__', '[]')
    .replace('__RELEASE__', JSON.stringify({build, version}))
    .replace('__ASSETS__', JSON.stringify(Object.fromEntries(manifest.map(e => [e.path, e.sha256]))))
    .replace('__IDENTITY__', '"../../../../version.json"')
    .replace('__PRECACHE_RUNTIME__', readTemplate('precache'));
  runInNewContext(script, {
    self: {
      location: new URL('sw.js', base),
      addEventListener: (name, handler) => { listeners[name] = handler; },
      clients: {claim: async () => {}},
      skipWaiting: async () => { skipCount++; }
    },
    URL, Response, caches, crypto: webcrypto,
    async fetch(url, options) {
      url = new URL(url.url || url);
      fetched.push({url, options});
      if (networkDown) throw new Error('Offline');
      const path = url.pathname.split('/').at(-1);
      if (path === 'version.json') return Response.json({build, version});
      if (path === errorFor) return new Response('wrong release', {headers: {'Content-Type': assets[path][1]}});
      const [body, type] = assets[path];
      return new Response(body, {headers: {'Content-Type': type}});
    }
  });
  function dispatch(event, fields = {}) {
    let pending;
    const capture = promise => { pending = promise; };
    listeners[event]({...fields, waitUntil: capture, respondWith: capture});
    return pending;
  }
  function request(path, mode = 'same-origin', referrer) {
    return dispatch('fetch', {request: {method: 'GET', mode, url: key(path), referrer}});
  }
  return {
    dispatch, request, fetched, files, oldName, cacheName, key,
    get cache() { return files.get(cacheName); },
    get skipped() { return skipCount; },
    down(value) { networkDown = value; },
    corruptNetwork(path) { errorFor = path; },
    hideFromStorage(path) { missOnRead = key(path); },
    blockWrites() { failOpen = true; }
  };
}

for (const template of Object.keys(variants)) {
  test(template + ' serves a verified hit and repairs missing, empty and wrong cached CSS', async () => {
    const f = fixture(template);
    await f.dispatch('install');
    const requested = 'style.bundle.css';
    const css = f.key(requested);
    f.fetched.length = 0;
    assert.equal(await (await f.request(requested + '?theme=1')).text(), assets[requested][0]);
    assert.equal(f.fetched.length, 0);
    for (const cached of [null, '', 'wrong release']) {
      if (cached === null) f.cache.delete(css);
      else f.cache.set(css, new Response(cached, {headers: {'Content-Type': 'text/css'}}));
      assert.equal(await (await f.request(requested)).text(), assets[requested][0]);
      assert.equal(await f.cache.get(css).text(), assets[requested][0]);
      assert.equal(f.fetched.at(-1).url.href, css + '?v=' + build);
      assert.equal(f.fetched.at(-1).options.cache, 'reload');
    }
    f.cache.delete(css);
    f.blockWrites();
    assert.equal(await (await f.request(requested)).text(), assets[requested][0]);
  });

  test(template + ' returns a network error for CSS and HTML fallback for navigation', async () => {
    const f = fixture(template);
    await f.dispatch('install');
    f.down(true);
    f.cache.delete(f.key('style.bundle.css'));
    f.cache.delete(f.key('index.html'));
    const css = await f.request('style.bundle.css');
    assert.equal(css.type, 'error');
    assert.equal(css.body, null);
    const navigation = await f.request('index.html', 'navigate');
    const page = navigation.status === 302 ? await f.request('offline.html', 'navigate') : navigation;
    assert.match(page.headers.get('Content-Type'), /^text\/html/);
    assert.match(await page.text(), /Reconnect/);
    f.cache.delete(f.key('offline.html'));
    assert.match(await (await f.request('index.html', 'navigate')).text(), /Reconnect to continue/);
  });

  test(template + ' retains active cache until a complete candidate activates', async () => {
    const f = fixture(template);
    const install = f.dispatch('install');
    assert.ok(f.files.has(f.oldName));
    assert.equal(f.skipped, 0);
    await install;
    assert.ok(f.files.has(f.oldName));
    assert.equal(f.cache.size, manifest.length);
    await f.dispatch('activate');
    assert.equal(f.files.has(f.oldName), false);
  });

  test(template + ' rolls back a mismatched response or an incomplete stored install', async () => {
    for (const fail of ['network', 'storage']) {
      const f = fixture(template);
      if (fail === 'network') f.corruptNetwork('style.bundle.css');
      else f.hideFromStorage('style.bundle.css');
      await assert.rejects(f.dispatch('install'), /Integrity check failed|Incomplete precache/);
      assert.ok(f.files.has(f.oldName));
      assert.equal(f.files.has(f.cacheName), false);
      assert.equal(f.skipped, 0);
    }
  });
}

for (const template of Object.keys(variants)) {
  test(template + ' refuses activation on failed re-verification and retries after network recovery', async () => {
    const f = fixture(template);
    await f.dispatch('install');
    f.cache.delete(f.key('style.bundle.css'));
    f.corruptNetwork('style.bundle.css');
    const messages = [];
    const activate = () => f.dispatch('message', {
      data: {type: 'SKIP_WAITING'}, ports: [{postMessage: message => messages.push(message.type)}]
    });
    await activate();
    assert.deepEqual(messages, ['UPDATE_FAILED']);
    assert.equal(f.skipped, 0);
    assert.ok(f.files.has(f.oldName));
    f.corruptNetwork(undefined);
    await activate();
    assert.equal(f.skipped, 1);
    assert.ok(f.cache.has(f.key('style.bundle.css')));
    assert.ok(f.files.has(f.oldName));
  });
}

test('v11 recovery clears only the active cache after a fresh navigation succeeds', async () => {
  const f = fixture('gjh-v11-sw');
  await f.dispatch('install');
  f.down(true);
  assert.match(await (await f.request('index.html?recover-page=1', 'navigate')).text(), /Reconnect/);
  assert.ok(f.cache);
  f.down(false);
  await f.request('index.html?recover-page=1', 'navigate');
  assert.equal(f.cache, undefined);
  assert.ok(f.files.has(f.oldName));
  f.corruptNetwork('style.bundle.css');
  const css = await f.request('style.bundle.css', 'same-origin', f.key('index.html?recover-page=1'));
  assert.equal(await css.text(), 'wrong release'); // Recovery loads the server's current release.
  assert.equal(f.cache, undefined);
});
