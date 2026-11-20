import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../demos/corporate/gjh/v11/pwa.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '');
const href = 'https://example.test/demos/corporate/gjh/v11/index.html';
const workerURL = new URL('pwa-sw.js', href).href;
const flush = () => new Promise(resolve => setImmediate(resolve));

class Element extends EventTarget {
  hidden = false;
  querySelector() { return null; }
  prepend() {}
  append() {}
}

function fixture(storage = new Map()) {
  const sw = new EventTarget();
  const registration = new EventTarget();
  const elements = new Map();
  let reloads = 0;
  let activationPort;
  let skipRequests = 0;
  function worker(build, state) {
    const item = new EventTarget();
    item.scriptURL = workerURL;
    item.state = state;
    item.postMessage = ({type}, [port]) => {
      if (type === 'GET_VERSION') port.postMessage({build, version: '2.0.0'});
      if (type === 'SKIP_WAITING') {
        skipRequests++;
        activationPort = port;
      }
    };
    return item;
  }
  const active = worker('old', 'activated');
  const waiting = worker('new', 'installed');
  registration.active = active;
  registration.waiting = waiting;
  registration.update = async () => {};
  sw.controller = active;
  sw.register = async () => registration;
  sw.ready = Promise.resolve(registration);
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  }
  element('#mall-update-notice').hidden = true;
  const window = new EventTarget();
  window.isSecureContext = true;
  runInNewContext(source, {
    window, URL, Event, AbortController, setTimeout, clearTimeout,
    MessageChannel: class {
      port1 = {close() { this.onmessage = null; }};
      port2 = {postMessage: data => queueMicrotask(() => this.port1.onmessage?.({data}))};
    },
    navigator: {serviceWorker: sw, onLine: true},
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    location: {href, reload() { reloads++; }},
    document: Object.assign(new EventTarget(), {
      querySelector: selector => selector === 'dialog[open]' ? null : element(selector),
      querySelectorAll: () => [],
      createElement: () => new Element()
    }),
    fetch: async () => Response.json({build: 'new', version: '2.0.0'}),
    icon: () => new Element()
  });
  return {
    click() { element('#mall-apply-update').dispatchEvent(new Event('click')); },
    element, sw, waiting, registration,
    failVerification() { activationPort.postMessage({type: 'UPDATE_FAILED'}); },
    get reloads() { return reloads; },
    get skipRequests() { return skipRequests; }
  };
}

test('Update now waits for controllerchange and reloads at most once per build in this tab', async () => {
  const storage = new Map();
  for (const expectedReloads of [1, 0]) {
    const f = fixture(storage);
    await flush();
    assert.equal(f.element('#mall-update-notice').hidden, false);
    f.click();
    f.click();
    await flush();
    assert.equal(f.skipRequests, 1);
    f.waiting.state = 'activated';
    f.waiting.dispatchEvent(new Event('statechange'));
    await flush();
    assert.equal(f.reloads, 0);
    f.sw.controller = f.waiting;
    f.sw.dispatchEvent(new Event('controllerchange'));
    f.sw.dispatchEvent(new Event('controllerchange'));
    await flush();
    assert.equal(f.reloads, expectedReloads);
    assert.deepEqual([...storage.values()], ['1']);
  }
});

test('failed verification keeps the controller and allows retry', async () => {
  const f = fixture();
  await flush();
  f.click();
  await flush();
  f.failVerification();
  await flush();
  assert.equal(f.reloads, 0);
  assert.equal(f.sw.controller, f.registration.active);
  assert.equal(f.element('#mall-apply-update').disabled, false);
  assert.match(f.element('#mall-update-message').textContent, /Update failed, retry/);
  f.click();
  await flush();
  assert.equal(f.skipRequests, 2);
  f.sw.controller = f.waiting;
  f.sw.dispatchEvent(new Event('controllerchange'));
  await flush();
  assert.equal(f.reloads, 1);
});

test('an interrupted install reports a retry without offering activation', async () => {
  const f = fixture();
  f.registration.installing = f.waiting;
  f.registration.waiting = null;
  f.waiting.state = 'installing';
  await flush();
  f.registration.dispatchEvent(new Event('updatefound'));
  f.waiting.state = 'redundant';
  f.waiting.dispatchEvent(new Event('statechange'));
  await flush();
  assert.equal(f.element('#mall-update-notice').hidden, true);
  assert.match(f.element('#arrival-update-status').textContent, /Update failed, retry/);
  assert.equal(f.skipRequests, 0);
  assert.equal(f.reloads, 0);
});

const html = readFileSync(new URL('../demos/corporate/gjh/v11/index.html', import.meta.url), 'utf8');
const recovery = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .find(([, script]) => script.includes('mall-recovery'))[1];

function recoveryFixture(position = 'fixed', pageURL = href) {
  const window = new EventTarget();
  const document = new EventTarget();
  const card = new Element();
  const label = new Element();
  const button = new Element();
  const loader = new Element();
  const loaderRetry = new Element();
  card.hidden = true;
  card.querySelector = selector => selector === 'span' ? label : button;
  document.getElementById = id => ({'mall-recovery': card, 'app-loader': loader, 'loader-retry': loaderRetry})[id];
  document.querySelector = () => button;
  const navigations = [];
  const replacements = [];
  runInNewContext(recovery, {
    URL, window, document, getComputedStyle: () => ({position}),
    location: {href: pageURL, replace: url => navigations.push(url)},
    history: {replaceState: (_state, _title, url) => replacements.push(url)}
  });
  return {window, document, card, label, button, loaderRetry, navigations, replacements};
}

test('stylesheet error and computed style failure each offer a network reload', () => {
  for (const position of ['fixed', 'static']) {
    const f = recoveryFixture(position, href + '?keep=1#experience');
    if (position === 'fixed') {
      const error = new Event('error');
      Object.defineProperty(error, 'target', {value: {id: 'mall-main-style'}});
      f.window.dispatchEvent(error);
    }
    f.document.dispatchEvent(new Event('DOMContentLoaded'));
    f.window.dispatchEvent(new Event('load'));
    assert.equal(f.card.hidden, false);
    assert.equal(f.label.textContent, 'Page did not load fully:');
    assert.equal(f.button.textContent, 'Reload');
    f.button.dispatchEvent(new Event('click'));
    assert.match(f.navigations[0].searchParams.get('recover-page'), /^\d+$/);
    assert.equal(f.navigations[0].searchParams.get('keep'), '1');
    assert.equal(f.navigations[0].hash, '#experience');
  }
});

test('module failure exposes Retry and recovery keeps the original URL after load', () => {
  const f = recoveryFixture('fixed', href + '?keep=1&recover-page=123');
  f.document.dispatchEvent(new Event('DOMContentLoaded'));
  f.window.dispatchEvent(new Event('load'));
  assert.equal(f.card.hidden, true);
  assert.equal(f.replacements[0].href, href + '?keep=1');
  f.window.dispatchEvent(new Event('mall-loader-failed'));
  assert.equal(f.card.hidden, false);
  assert.match(f.label.textContent, /could not start/);
  assert.equal(f.button.textContent, 'Retry');
  f.button.dispatchEvent(new Event('click'));
  f.loaderRetry.dispatchEvent(new Event('click'));
  assert.equal(f.navigations.length, 2);
  assert.ok(f.navigations.every(url => url.searchParams.has('recover-page')));
});
