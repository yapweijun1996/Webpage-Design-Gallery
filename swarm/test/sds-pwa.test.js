'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const SWARM = path.join(__dirname, '..');
const SCOPE = 'https://example.test/repository/preview/';
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-pwa-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dist = path.join(root, 'project/dist');
  function write(file, contents) {
    const destination = path.join(root, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
  }

  write('swarm/tools/export-page.js', fs.readFileSync(path.join(SWARM, 'tools/export-page.js')));
  write('swarm/lib/catalog.js', fs.readFileSync(path.join(SWARM, 'lib/catalog.js')));
  write('swarm/lib/layers.js', fs.readFileSync(path.join(SWARM, 'lib/layers.js')));
  fs.cpSync(path.join(SWARM, 'design-system/shell'), path.join(root, 'swarm/design-system/shell'), { recursive: true });
  const system = {
    'tokens.css': ':root { --sds-color-bg: #eef3e8; }',
    'themes.css': '[data-theme="dark"] { --sds-color-bg: #101c16; }',
    'components.css': '.sds-spinner { color: currentColor; }',
    'boot.js': 'document.documentElement.setAttribute("data-loading", "");',
    'runtime.js': 'window.SDS = { version: "1.0.0" };',
    'i18n.js': 'window.SDS.i18n = {};',
  };
  for (const [file, contents] of Object.entries(system)) write(`swarm/design-system/${file}`, contents);
  for (const lang of ['en', 'zh-Hans', 'ms']) {
    write(`swarm/design-system/i18n/${lang}.json`, JSON.stringify({ meta: { lang }, messages: {} }));
  }
  write('project/tokens.css', ':root {}');
  write('project/sections/01-hero.html', '<section><h1>Fixture</h1><img src="/gjh/logo.png?v=2"><img src="/gjh-v11/card.png"></section>');
  write('project/sections/01-hero.css', 'section { color: var(--sds-color-text); }');
  write('assets/companies/gjh/logo.png', 'asset bytes');
  write('demos/corporate/gjh/v11/assets/card.png', 'other bytes');

  return {
    root, dist, system, write,
    text(file) { return fs.readFileSync(path.join(dist, file), 'utf8'); },
    files() {
      return fs.readdirSync(dist, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
        .map(entry => path.relative(dist, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')).sort();
    },
    run(...args) {
      const result = spawnSync(process.execPath, ['swarm/tools/export-page.js', 'project', ...args], { cwd: root, encoding: 'utf8' });
      assert.ifError(result.error);
      return result;
    },
    export(...args) {
      const result = this.run(...args);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
    },
  };
}

function precache(worker) {
  return JSON.parse(worker.match(/^const PRECACHE = (.+);$/m)[1]);
}

function cacheName(worker) {
  return JSON.parse(worker.match(/^const CACHE_NAME = (.+);$/m)[1]);
}

test('exports the full PWA and precaches exactly the files on disk', t => {
  const f = fixture(t);
  f.export();
  const expected = [
    'assets/logo.png', 'assets/v11-card.png', 'design-system/components.css', 'design-system/i18n.js',
    'design-system/runtime.js', 'design-system/themes.css', 'design-system/tokens.css', 'i18n/en.json',
    'i18n/ms.json', 'i18n/zh-Hans.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
    'index.html', 'manifest.webmanifest', 'offline.html', 'sw.js', 'version.json',
  ];
  const page = f.text('index.html');
  const worker = f.text('sw.js');
  const version = JSON.parse(f.text('version.json'));
  const listHash = createHash('sha256').update(JSON.stringify(expected)).digest('hex').slice(0, 16);
  assert.deepEqual(f.files(), expected);
  assert.deepEqual(precache(worker), f.files());
  assert.deepEqual(version.files, f.files());
  assert.match(version.hash, /^[a-f0-9]{64}$/);
  assert.equal(version.version, version.hash.slice(0, 16));
  assert.equal(cacheName(worker), `sds-${version.version}-${listHash}`);
  assert.match(page, /^<!doctype html>\n<html lang="en" data-viewport-lock data-default-brand="none">/);
  assert.deepEqual(page.match(/<meta name="viewport"[^>]+>/g), [VIEWPORT]);
  assert.ok(page.includes('html{touch-action:manipulation}'));
  assert.match(page, /html\[data-loading\] \[data-sds-first-paint\] \{[^}]+position: fixed;/);
  assert.ok(page.includes('<span class="sds-spinner"></span>'));
  assert.ok(page.indexOf(f.system['boot.js']) < page.indexOf('<link rel="stylesheet"'));
  assert.match(page, /<script defer src="design-system\/runtime.js"><\/script>/);
  for (const file of ['tokens.css', 'themes.css', 'components.css']) {
    assert.ok(page.includes(`<link rel="stylesheet" href="design-system/${file}">`));
    assert.equal(f.text(`design-system/${file}`), f.system[file]);
  }
  for (const control of ['theme', 'brand', 'lang']) assert.ok(page.includes(`data-sds-select="${control}"`));
  assert.ok(page.includes(`<p><span data-i18n="sds.version">Version</span> <span>${version.version}</span></p>`));
  assert.ok(page.includes('src="assets/logo.png?v=2"'));
  assert.ok(page.includes('src="assets/v11-card.png"'));
  assert.equal(f.text('assets/logo.png'), 'asset bytes');
  assert.equal(f.text('assets/v11-card.png'), 'other bytes');
  assert.match(f.text('offline.html'), /<h1>You’re offline<\/h1>/);
});

test('manifest URLs resolve under a subpath and all three icon headers match their declared sizes', t => {
  const f = fixture(t);
  const title = 'A "Shop" & <Cafe> {{VERSION}}';
  f.export('--title', title);
  const manifest = JSON.parse(f.text('manifest.webmanifest'));
  assert.equal(manifest.name, title);
  assert.equal(manifest.short_name, title);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#eef3e8');
  assert.equal(manifest.background_color, '#eef3e8');
  for (const property of ['start_url', 'scope']) {
    assert.equal(manifest[property], './');
    assert.equal(new URL(manifest[property], `${SCOPE}manifest.webmanifest`).href, SCOPE);
  }
  assert.deepEqual(manifest.icons.map(({ sizes, purpose }) => [sizes, purpose]), [
    ['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable'],
  ]);
  for (const { src, sizes, type, purpose } of manifest.icons) {
    assert.equal(new URL(src, SCOPE).href, `${SCOPE}${src}`);
    assert.equal(type, 'image/png');
    const png = fs.readFileSync(path.join(f.dist, src));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, sizes);
    if (purpose === 'maskable') assert.equal(png[25], 2);
  }
  const page = f.text('index.html');
  assert.ok(page.includes('<link rel="manifest" href="manifest.webmanifest">'));
  assert.ok(page.includes('<link rel="apple-touch-icon" href="icons/icon-192.png">'));
  assert.ok(page.includes('<meta name="theme-color" content="#eef3e8">'));
  assert.ok(page.includes('<title>A "Shop" &amp; &lt;Cafe&gt; {{VERSION}}</title>'));
});

test('loads project translations before language initialization and includes merged catalogs offline', t => {
  const f = fixture(t);
  f.write('swarm/design-system/i18n/ms.json', JSON.stringify({ messages: { greeting: 'Generic', theme: 'Tema' } }));
  f.write('project/i18n/ms.json', JSON.stringify({ meta: { lang: 'ms' }, messages: { greeting: 'Selamat datang' } }));
  f.export('--langs', 'ms');
  const page = f.text('index.html');
  const i18n = page.indexOf('<script defer src="design-system/i18n.js">');
  assert.ok(i18n >= 0 && i18n < page.indexOf('<script defer src="design-system/runtime.js">'));
  assert.deepEqual(JSON.parse(f.text('i18n/ms.json')).messages, { greeting: 'Selamat datang', theme: 'Tema' });
  assert.ok(precache(f.text('sw.js')).includes('i18n/ms.json'));
  const version = f.text('version.json');
  f.write('project/i18n/ms.json', JSON.stringify({ messages: { greeting: 'Halaman utama' } }));
  f.export('--langs', 'ms');
  assert.notEqual(f.text('version.json'), version);
  const good = f.text('version.json');
  f.write('project/i18n/ms.json', '{');
  assert.equal(f.run('--langs', 'ms').status, 1);
  assert.equal(f.text('version.json'), good);
});

test('brand and language options narrow the output and remove stale generated files on re-export', t => {
  const f = fixture(t);
  f.export();
  f.write('project/sections/01-hero.html', '<h1>Revised</h1>');
  f.export('--brand', 'forest-gold', '--langs', 'zh-Hans, zh-Hans');
  const page = f.text('index.html');
  assert.match(page, /<html lang="en" data-viewport-lock data-default-brand="forest-gold">/);
  assert.match(page, /<option value="en">English<\/option>/);
  assert.equal((page.match(/<option value="zh-Hans">/g) ?? []).length, 1);
  assert.doesNotMatch(page, /<option value="ms">/);
  assert.deepEqual(f.files().filter(file => /^(?:assets|i18n)\//.test(file)), ['i18n/zh-Hans.json']);
  assert.deepEqual(precache(f.text('sw.js')), f.files());
});

test('exports Chinese New Year as the page default and a selectable brand', t => {
  const f = fixture(t);
  f.export('--brand', 'cny-red-gold');
  const page = f.text('index.html');
  assert.match(page, /<html lang="en" data-viewport-lock data-default-brand="cny-red-gold">/);
  assert.match(page, /<option value="cny-red-gold">Chinese New Year<\/option>/);
});

test('content changes rotate the version while an identical export is reproducible', t => {
  const f = fixture(t);
  f.export();
  const identity = f.text('version.json');
  const worker = f.text('sw.js');
  f.export();
  assert.equal(f.text('version.json'), identity);
  assert.equal(f.text('sw.js'), worker);
  f.write('assets/companies/gjh/logo.png', 'asset edits');
  f.export();
  assert.notEqual(JSON.parse(f.text('version.json')).hash, JSON.parse(identity).hash);
  assert.notEqual(cacheName(f.text('sw.js')), cacheName(worker));
  assert.equal(cacheName(f.text('sw.js')).split('-').at(-1), cacheName(worker).split('-').at(-1));
  assert.deepEqual(precache(f.text('sw.js')), precache(worker));
});

test('a specialist layer changes the PWA page and cache identity', t => {
  const f = fixture(t);
  f.export();
  const originalCache = cacheName(f.text('sw.js'));
  f.write('project/sections/01-hero.color.css', '.s-01 { color: var(--sds-color-text-muted); }');
  f.export();
  assert.match(f.text('index.html'), /\/\* layer: color \*\/\n\.s-01 \{ color: var\(--sds-color-text-muted\); \}/);
  assert.notEqual(cacheName(f.text('sw.js')), originalCache);
});

test('invalid options and missing required inputs fail before writing output', t => {
  const f = fixture(t);
  const badBrand = f.run('--brand', 'blue');
  assert.equal(badBrand.status, 1);
  assert.match(badBrand.stderr, /Unknown brand "blue"/);
  const badLang = f.run('--langs', 'en,');
  assert.equal(badLang.status, 1);
  assert.match(badLang.stderr, /Unknown language ""/);
  fs.unlinkSync(path.join(f.root, 'swarm/design-system/runtime.js'));
  const missing = f.run();
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Missing SDS PWA input: .*design-system[\\/]runtime\.js/);
  assert.equal(fs.existsSync(f.dist), false);
});

test('refuses unrelated existing files without modifying either them or the previous build', t => {
  const f = fixture(t);
  f.export();
  const page = f.text('index.html');
  f.write('project/dist/assets/local-note.txt', 'keep this');
  const result = f.run('--title', 'Changed title');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected files in PWA output: assets\/local-note\.txt/);
  assert.equal(f.text('assets/local-note.txt'), 'keep this');
  assert.equal(f.text('index.html'), page);
});

test('shell only installs an update on click and allows retry after an update error', async t => {
  const f = fixture(t);
  f.export();
  const page = f.text('index.html');
  const callbacks = new Map();
  const calls = [];
  const elements = {
    '[data-sds-update-status]': { textContent: '' },
    '[data-sds-update-toast]': { hidden: true },
  };
  for (const action of ['check-updates', 'apply-update']) {
    elements[`[data-sds-${action}]`] = {
      disabled: false,
      addEventListener(event, callback) { callbacks.set(`${action}:${event}`, callback); },
    };
  }
  const script = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  let applyFails = true;
  vm.runInNewContext(script, {
    document: {
      addEventListener(event, callback) { callbacks.set(event, callback); },
      querySelector(selector) { return elements[selector]; },
    },
    window: { SDS: {
      on(event, callback) { callbacks.set(event, callback); },
      update: {
        check() { calls.push('check'); },
        async apply() {
          assert.equal(elements['[data-sds-apply-update]'].disabled, true);
          calls.push('apply');
          if (applyFails) throw new Error('worker unavailable');
        },
      },
    } },
  });
  assert.match(page, /class="sds-toast" data-sds-update-toast hidden/);
  assert.match(page, />Check updates<\/button>/);
  assert.match(page, />Update now<\/button>/);
  callbacks.get('DOMContentLoaded')();
  assert.deepEqual(calls, []);
  await callbacks.get('check-updates:click')();
  assert.deepEqual(calls, ['check']);
  callbacks.get('updateavailable')();
  assert.equal(elements['[data-sds-update-toast]'].hidden, false);
  assert.deepEqual(calls, ['check']);
  await callbacks.get('apply-update:click')();
  assert.match(elements['[data-sds-update-status]'].textContent, /Try again/);
  assert.equal(elements['[data-sds-apply-update]'].disabled, false);
  applyFails = false;
  await callbacks.get('apply-update:click')();
  assert.deepEqual(calls, ['check', 'apply', 'apply']);
});

function startWorker(f) {
  const script = f.text('sw.js');
  const current = cacheName(script);
  const handlers = new Map();
  const installed = new Map();
  const older = new Map([
    ['sds-old-list', [`${SCOPE}index.html`]],
    ['sds-other-list', ['https://example.test/different/index.html']],
    ['sds-shared-list', [
      `${SCOPE}index.html`, `${SCOPE}version.json`, `${SCOPE}nested/index.html`, `${SCOPE}nested/version.json`,
      'https://example.test/different/index.html',
    ]],
    ['unrelated-cache', [`${SCOPE}index.html`]],
  ]);
  const calls = { skipped: 0, claimed: 0, deleted: [], removedEntries: [], network: [], precached: [] };
  const worker = { current, calls, installed, offline: false };
  vm.runInNewContext(script, {
    URL, Request, Response,
    fetch: async request => {
      calls.network.push(request.url);
      if (worker.offline) throw new TypeError('offline');
      return new Response('network');
    },
    self: {
      registration: { scope: SCOPE },
      addEventListener(type, handler) { handlers.set(type, handler); },
      async skipWaiting() { calls.skipped++; },
      clients: { async claim() { calls.claimed++; } },
    },
    caches: {
      async keys() { return [current, ...older.keys()]; },
      async delete(name) { calls.deleted.push(name); older.delete(name); },
      async open(name) {
        if (name !== current) {
          return {
            async keys() { return older.get(name).map(url => ({ url })); },
            async delete({ url }) { calls.removedEntries.push([name, url]); },
          };
        }
        return {
          async addAll(requests) {
            for (const { url, cache } of requests) {
              calls.precached.push(url);
              assert.equal(cache, 'reload');
              installed.set(url, f.text(url.slice(SCOPE.length)));
            }
          },
          async match(url) { if (installed.has(url)) return new Response(installed.get(url)); },
        };
      },
    },
  });
  worker.dispatch = (type, properties) => {
    let result;
    handlers.get(type)({
      ...properties,
      waitUntil(promise) { result = promise; },
      respondWith(promise) { result = promise; },
    });
    return result;
  };
  worker.request = (url, mode, method = 'GET') => worker.dispatch('fetch', { request: { url, method, mode } });
  return worker;
}

test('service worker installs, cleans older caches and waits for a SKIP_WAITING message', async t => {
  const f = fixture(t);
  f.export();
  const { calls, dispatch } = startWorker(f);
  await dispatch('install');
  assert.deepEqual(calls.precached, f.files().map(file => `${SCOPE}${file}`));
  assert.equal(calls.skipped, 0);
  assert.equal(dispatch('message', { data: 'SKIP_WAITING' }), undefined);
  assert.equal(dispatch('message', { data: null }), undefined);
  assert.equal(dispatch('message', { data: { type: 'CHECK' } }), undefined);
  assert.equal(calls.skipped, 0);
  await dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(calls.skipped, 1);
  await dispatch('activate');
  assert.equal(calls.skipped, 1);
  assert.equal(calls.claimed, 1);
  assert.deepEqual(calls.deleted, ['sds-old-list']);
  assert.deepEqual(calls.removedEntries, ['index.html', 'version.json'].map(file => ['sds-shared-list', `${SCOPE}${file}`]));
});

test('service worker uses cached files, falls back to network and serves offline only for failed navigations', async t => {
  const f = fixture(t);
  f.export();
  const worker = startWorker(f);
  await worker.dispatch('install');
  assert.equal(await (await worker.request(`${SCOPE}?from=install`, 'navigate')).text(), f.text('index.html'));
  assert.equal(await (await worker.request(`${SCOPE}assets/logo.png?v=2`, 'no-cors')).text(), 'asset bytes');
  assert.deepEqual(worker.calls.network, []);
  worker.installed.delete(`${SCOPE}assets/logo.png`);
  assert.equal(await (await worker.request(`${SCOPE}assets/logo.png?v=2`, 'no-cors')).text(), 'network');
  assert.equal(await (await worker.request(`${SCOPE}other/deep`, 'navigate')).text(), 'network');
  worker.offline = true;
  assert.equal(await (await worker.request(`${SCOPE}other/deep`, 'navigate')).text(), f.text('offline.html'));
  await assert.rejects(worker.request(`${SCOPE}assets/logo.png`, 'no-cors'), /offline/);
  assert.equal(worker.request(`${SCOPE}uncached.png`, 'no-cors'), undefined);
  assert.equal(worker.request(`${SCOPE}index.html`, 'navigate', 'POST'), undefined);
  assert.equal(worker.request('https://example.test/unrelated/', 'navigate'), undefined);
});
