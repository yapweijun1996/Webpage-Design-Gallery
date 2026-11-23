'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const designSystem = path.join(__dirname, '../design-system');
const boot = new vm.Script(fs.readFileSync(path.join(designSystem, 'boot.js'), 'utf8'), { filename: 'boot.js' });
const runtime = new vm.Script(fs.readFileSync(path.join(designSystem, 'runtime.js'), 'utf8'), { filename: 'runtime.js' });

class EventStub {
  constructor(type, { detail } = {}) {
    this.type = type;
    this.detail = detail;
    this.defaultPrevented = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, fn, options = {}) {
    const entries = this.listeners.get(type) || [];
    if (!entries.some(entry => entry.fn === fn)) entries.push({ fn, options });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry.fn !== fn));
  }

  dispatchEvent(event) {
    event.target = event.target || this;
    for (const { fn, options } of [...(this.listeners.get(event.type) || [])]) {
      if (options.once) this.removeEventListener(event.type, fn);
      fn(event);
    }
    return !event.defaultPrevented;
  }
}

class ElementStub extends EventTargetStub {
  constructor(tag, attributes = {}, parentElement = null) {
    super();
    this.tag = tag;
    this.attributes = new Map(Object.entries(attributes));
    this.parentElement = parentElement;
    this.value = '';
    this.rect = { top: 0, bottom: 20 };
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  getBoundingClientRect() { return this.rect; }

  matches(selectors) {
    return selectors.split(',').some(selector => {
      const parts = /^([a-z]+)?(?:\[([a-z-]+)(?:="([^"]*)")?\])?(?::not\(\[([a-z-]+)\]\))?$/.exec(selector);
      assert.ok(parts, 'Unsupported fixture selector: ' + selector);
      const [, tag, attribute, value, excluded] = parts;
      return (!tag || this.tag === tag) &&
        (!attribute || this.hasAttribute(attribute) && (value === undefined || this.getAttribute(attribute) === value)) &&
        (!excluded || !this.hasAttribute(excluded));
    });
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
}

const colors = {
  none: { light: '#ffffff', dark: '#151515' },
  'forest-gold': { light: '#f7efdc', dark: '#101c16' },
  'gjh-classic': { light: '#edeef2', dark: '#0f1115' },
  'cny-red-gold': { light: '#fff7e6', dark: '#29070b' }
};

function createPage(options = {}) {
  const doc = new EventTargetStub();
  const win = new EventTargetStub();
  const root = new ElementStub('html', options.attributes);
  const meta = new ElementStub('meta', { name: 'theme-color', content: 'initial' });
  const elements = [meta, ...(options.elements || [])];
  const storage = options.storage || new Map();
  const darkScheme = new EventTargetStub();
  const motion = { matches: Boolean(options.reducedMotion) };
  const observers = [];
  const frames = [];
  const timers = new Map();
  let now = 0;
  let timerId = 0;

  doc.documentElement = root;
  doc.readyState = options.readyState || 'loading';
  doc.fonts = options.fonts;
  doc.querySelectorAll = selector => elements.filter(element => element.matches(selector));
  doc.querySelector = selector => doc.querySelectorAll(selector)[0] || null;

  Object.assign(win, {
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    },
    matchMedia(query) {
      if (query === '(prefers-color-scheme: dark)') return darkScheme;
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return motion;
    },
    CSS: { supports: (property, value) => property === 'animation-timeline' && value === 'view()' && options.nativeReveal },
    innerHeight: 800,
    navigator: options.serviceWorkers ? { serviceWorker: options.serviceWorkers } : {},
    getComputedStyle(element) {
      assert.equal(element, root);
      return {
        getPropertyValue(property) {
          assert.equal(property, '--sds-color-bg');
          const brand = root.getAttribute('data-brand');
          const preference = root.getAttribute('data-theme');
          const theme = preference === 'auto' ? (darkScheme.matches ? 'dark' : 'light') : preference;
          return options.noCssToken ? ' ' : ' ' + colors[brand][theme] + ' ';
        }
      };
    },
    setTimeout(fn, delay) {
      timers.set(++timerId, { fn, at: now + delay });
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { frames.push(fn); },
    IntersectionObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.observed = new Set();
        observers.push(this);
      }

      observe(element) { this.observed.add(element); }
      unobserve(element) { this.observed.delete(element); }
      notify(target, isIntersecting) {
        assert.ok(this.observed.has(target), 'Only observed elements receive intersections');
        this.callback([{ target, isIntersecting }], this);
      }
    }
  });

  if (options.storageBlocked) {
    Object.defineProperty(win, 'localStorage', { get() { throw new Error('Storage is blocked'); } });
  }
  if (options.storageMethodsBlocked) {
    const blocked = () => { throw new Error('Storage access denied'); };
    win.localStorage = { getItem: blocked, setItem: blocked };
  }
  if (options.noMatchMedia) delete win.matchMedia;
  if (options.noIntersectionObserver) delete win.IntersectionObserver;
  darkScheme.matches = Boolean(options.dark);
  if (options.legacyMedia) {
    darkScheme.addListener = darkScheme.addEventListener.bind(darkScheme, 'change');
    darkScheme.addEventListener = undefined;
  }

  const context = vm.createContext({ window: win, document: doc, CustomEvent: EventStub });

  function dispatch(type, target) {
    const event = new EventStub(type);
    event.target = target;
    doc.dispatchEvent(event);
    return event;
  }

  return {
    win, doc, root, meta, storage, observers,
    get sds() { return win.SDS; },
    runBoot() { boot.runInContext(context); },
    runRuntime() { runtime.runInContext(context); },
    start() {
      this.runRuntime();
      this.domReady();
    },
    domReady() {
      doc.readyState = 'interactive';
      dispatch('DOMContentLoaded');
    },
    systemTheme(dark) {
      darkScheme.matches = dark;
      darkScheme.dispatchEvent(new EventStub('change'));
    },
    dispatch,
    paint() { frames.splice(0).forEach(fn => fn()); },
    advance(ms) {
      const deadline = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > deadline) break;
        const [id, { fn, at }] = next;
        now = at;
        timers.delete(id);
        fn();
      }
      now = deadline;
    }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

test('theme and brand persist; the meta color uses the resolved brand and theme token', () => {
  const first = createPage({ attributes: { 'data-default-brand': 'gjh-classic' } });
  first.start();
  assert.match(first.sds.version, /^\d+\.\d+\.\d+$/);
  assert.equal(first.sds.theme.get(), 'auto');
  assert.equal(first.sds.brand.get(), 'gjh-classic');
  assert.equal(first.meta.getAttribute('content'), '#edeef2');

  first.sds.theme.set('dark');
  assert.equal(first.meta.getAttribute('content'), '#0f1115');
  first.sds.brand.set('forest-gold');
  assert.equal(first.meta.getAttribute('content'), '#101c16');
  assert.equal(first.storage.get('sds.theme'), 'dark');
  assert.equal(first.storage.get('sds.brand'), 'forest-gold');

  const second = createPage({ storage: first.storage });
  second.start();
  assert.equal(second.root.getAttribute('data-theme'), 'dark');
  assert.equal(second.root.getAttribute('data-brand'), 'forest-gold');
  assert.equal(second.meta.getAttribute('content'), '#101c16');
  second.sds.brand.set('none');
  assert.equal(second.root.getAttribute('data-brand'), 'none');
  assert.equal(second.meta.getAttribute('content'), '#151515');
});

for (const legacyMedia of [false, true]) {
  test('auto follows system changes without overwriting storage (' + (legacyMedia ? 'legacy' : 'standard') + ' listener)', () => {
    const storage = new Map([['sds.theme', 'auto']]);
    const page = createPage({ storage, legacyMedia });
    page.start();
    const changes = [];
    page.sds.on('themechange', event => changes.push([event.detail.theme, event.detail.resolvedTheme]));

    page.systemTheme(true);
    assert.equal(page.root.getAttribute('data-theme'), 'auto');
    assert.equal(page.meta.getAttribute('content'), '#151515');
    assert.equal(storage.get('sds.theme'), 'auto');
    page.sds.theme.set('light');
    page.systemTheme(false);
    page.systemTheme(true);
    assert.equal(page.meta.getAttribute('content'), '#ffffff');
    page.sds.theme.set('auto');
    page.systemTheme(false);
    assert.deepEqual(changes, [['auto', 'dark'], ['light', 'light'], ['auto', 'dark'], ['auto', 'light']]);
  });
}

test('ready and change events expose committed preferences in order; off removes the listener', () => {
  const page = createPage();
  const observed = [];
  page.runRuntime();
  page.sds.on('ready', event => {
    observed.push(event.type);
    assert.equal(page.meta.getAttribute('content'), '#ffffff');
  });
  page.sds.on('themechange', event => {
    assert.equal(page.root.getAttribute('data-theme'), event.detail.theme);
    assert.equal(page.storage.get('sds.theme'), event.detail.theme);
    observed.push(event.type);
  });
  const onBrand = event => {
    assert.equal(page.root.getAttribute('data-brand'), event.detail.brand);
    observed.push(event.type);
  };
  page.sds.on('brandchange', onBrand);
  page.sds.on('langchange', event => {
    assert.equal(page.root.getAttribute('lang'), event.detail.lang);
    observed.push(event.type);
  });
  page.domReady();
  page.sds.theme.set('dark');
  page.sds.theme.set('dark');
  page.sds.theme.set('sepia');
  page.sds.brand.set('forest-gold');
  page.sds.lang.set('zh-Hans');
  page.sds.lang.set(null);
  page.sds.off('brandchange', onBrand);
  page.sds.brand.set('none');
  page.domReady();
  assert.deepEqual(observed, ['ready', 'themechange', 'brandchange', 'langchange']);
  assert.equal(page.sds.theme.get(), 'dark');
  assert.equal(page.sds.lang.get(), 'zh-Hans');
});

test('language preserves a preloaded i18n adapter and delegates to apply when it is present', () => {
  const page = createPage({ attributes: { lang: 'ms' } });
  const applied = [];
  const i18n = { apply() { applied.push(page.root.getAttribute('lang')); } };
  page.win.SDS = { i18n };
  page.start();
  assert.equal(page.sds.i18n, i18n);
  assert.deepEqual(Array.from(page.sds.lang.list), ['en', 'zh-Hans', 'ms']);
  assert.equal(page.sds.lang.get(), 'ms');

  page.sds.lang.set('zh-Hans');
  assert.equal(page.root.getAttribute('lang'), 'zh-Hans');
  assert.equal(page.storage.get('sds.lang'), 'zh-Hans');
  assert.deepEqual(applied, ['ms', 'zh-Hans']);
  const reopened = createPage({ storage: page.storage, attributes: { lang: 'en' } });
  reopened.start();
  assert.equal(reopened.sds.lang.get(), 'zh-Hans');
});

test('language waits for the current catalog, skips obsolete requests and recovers after load failure', async () => {
  const page = createPage();
  const loads = [];
  const applied = [];
  let catalog;
  page.runRuntime();
  page.sds.i18n = {
    load(lang) {
      const entry = deferred();
      loads.push({ lang, ...entry });
      return entry.promise.then(() => { catalog = lang; });
    },
    apply() { applied.push(catalog); }
  };
  page.domReady();
  page.sds.lang.set('zh-Hans');
  page.sds.lang.set('ms');
  assert.equal(page.root.getAttribute('lang'), 'ms');
  loads[0].resolve();
  await flush();
  assert.deepEqual(loads.map(entry => entry.lang), ['en', 'ms']);
  assert.deepEqual(applied, []);
  loads[1].reject(new Error('Catalog unavailable'));
  await flush();
  assert.deepEqual(applied, []);

  page.sds.lang.set('zh-Hans');
  await flush();
  assert.equal(loads[2].lang, 'zh-Hans');
  loads[2].resolve();
  await flush();
  assert.deepEqual(applied, ['zh-Hans']);
});

test('delegated clicks and select changes update each control and its aria-pressed state', () => {
  const theme = new ElementStub('button', { 'data-sds-theme': 'dark' });
  const brand = new ElementStub('button', { 'data-sds-brand': 'forest-gold' });
  const lang = new ElementStub('button', { 'data-sds-lang': 'zh-Hans' });
  const auto = new ElementStub('button', { 'data-sds-theme': 'auto' });
  const label = new ElementStub('span', {}, theme);
  const invalid = new ElementStub('button', { 'data-sds-theme': 'sepia' });
  const unknownSelect = new ElementStub('select', { 'data-sds-select': 'constructor' });
  const selects = ['theme', 'brand', 'lang'].map(name => new ElementStub('select', { 'data-sds-select': name }));
  const page = createPage({ elements: [theme, brand, lang, auto, label, invalid, unknownSelect, ...selects] });
  page.start();
  const elements = [theme, brand, lang];
  const active = () => elements.map(element => element.getAttribute('aria-pressed'));
  const selected = () => selects.map(select => select.value);
  assert.deepEqual(active(), ['false', 'false', 'false']);
  assert.deepEqual(selected(), ['auto', 'none', 'en']);
  assert.equal(auto.getAttribute('aria-pressed'), 'true');
  assert.equal(page.dispatch('click', label).defaultPrevented, true);
  page.dispatch('click', brand);
  page.dispatch('click', lang);
  assert.equal(page.dispatch('click', invalid).defaultPrevented, false);
  page.dispatch('change', unknownSelect);
  page.dispatch('change', page.doc);
  assert.deepEqual(active(), ['true', 'true', 'true']);
  assert.deepEqual(selected(), ['dark', 'forest-gold', 'zh-Hans']);
  assert.equal(auto.getAttribute('aria-pressed'), 'false');

  const next = ['auto', 'gjh-classic', 'ms'];
  selects.forEach((select, index) => {
    select.value = next[index];
    page.dispatch('change', select);
  });
  assert.deepEqual(active(), ['false', 'false', 'false']);
  assert.equal(auto.getAttribute('aria-pressed'), 'true');
  assert.deepEqual([page.sds.theme.get(), page.sds.brand.get(), page.sds.lang.get()], next);
});

test('blocked storage getters and methods leave all preferences usable without matchMedia', () => {
  for (const mode of ['storageBlocked', 'storageMethodsBlocked']) {
    const page = createPage({ [mode]: true, noMatchMedia: true, attributes: { 'data-default-brand': 'forest-gold' } });
    page.start();
    assert.equal(page.meta.getAttribute('content'), '#f7efdc');
    page.sds.theme.set('dark');
    page.sds.brand.set('gjh-classic');
    page.sds.lang.set('ms');
    assert.equal(page.root.getAttribute('data-theme'), 'dark');
    assert.equal(page.root.getAttribute('data-brand'), 'gjh-classic');
    assert.equal(page.root.getAttribute('lang'), 'ms');
    assert.equal(page.meta.getAttribute('content'), '#0f1115');
  }
});

test('a late runtime initializes once and keeps the theme-color fallback when the CSS token is absent', () => {
  const page = createPage({ readyState: 'complete', noCssToken: true });
  page.runRuntime();
  let ready = 0;
  page.sds.on('ready', () => { ready += 1; });
  page.advance(0);
  assert.equal(ready, 1);
  assert.equal(page.meta.getAttribute('content'), 'initial');
});

test('gesturestart is prevented only on a locked viewport, using a non-passive listener', () => {
  const normal = createPage();
  normal.start();
  assert.equal(normal.doc.listeners.has('gesturestart'), false);
  assert.equal(normal.dispatch('gesturestart').defaultPrevented, false);

  const locked = createPage({ attributes: { 'data-viewport-lock': '' } });
  locked.runRuntime();
  assert.equal(locked.doc.listeners.get('gesturestart')[0].options.passive, false);
  assert.equal(locked.dispatch('gesturestart').defaultPrevented, true);
  assert.equal(locked.dispatch('gesturechange').defaultPrevented, false);
});

test('loader times out after 2500 ms even if the DOM and first paint are delayed', async () => {
  const page = createPage();
  page.runBoot();
  page.runRuntime();
  page.advance(2499);
  assert.equal(page.root.hasAttribute('data-loading'), true);
  page.advance(1);
  assert.equal(page.root.hasAttribute('data-loading'), false);

  page.sds.loader.show();
  page.domReady();
  page.paint();
  page.paint();
  await flush();
  assert.equal(page.root.hasAttribute('data-loading'), true, 'Expired startup work must leave a later loader alone');
  page.sds.loader.hide();
  assert.equal(page.root.hasAttribute('data-loading'), false);
});

test('loader waits for first paint, fonts and above-the-fold images, including image errors', async () => {
  const fonts = deferred();
  const loaded = new ElementStub('img');
  const broken = new ElementStub('img');
  const belowFold = new ElementStub('img');
  belowFold.rect = { top: 800, bottom: 1000 };
  const page = createPage({ fonts: { ready: fonts.promise }, elements: [loaded, broken, belowFold] });
  page.runBoot();
  page.start();
  page.paint();
  assert.equal(loaded.listeners.has('load'), false);
  page.paint();
  assert.equal(loaded.listeners.get('load').length, 1);
  assert.equal(belowFold.listeners.has('load'), false);

  loaded.dispatchEvent(new EventStub('load'));
  fonts.resolve();
  await flush();
  assert.equal(page.root.hasAttribute('data-loading'), true);
  broken.dispatchEvent(new EventStub('error'));
  await flush();
  assert.equal(page.root.hasAttribute('data-loading'), false);
});

test('loader timeout releases image listeners and late font completion leaves a new loader alone', async () => {
  const image = new ElementStub('img');
  const fonts = deferred();
  const page = createPage({ elements: [image], fonts: { ready: fonts.promise } });
  page.runBoot();
  page.start();
  page.paint();
  page.paint();
  page.advance(2500);
  assert.equal(page.root.hasAttribute('data-loading'), false);
  assert.equal(image.listeners.get('load').length, 0);
  assert.equal(image.listeners.get('error').length, 0);
  page.sds.loader.show();
  fonts.resolve();
  await flush();
  assert.equal(page.root.hasAttribute('data-loading'), true);
});

test('boot times out without a runtime and leaves an explicitly shown loader alone', () => {
  const delayed = createPage();
  delayed.runBoot();
  delayed.advance(2499);
  assert.equal(delayed.root.hasAttribute('data-loading'), true);
  delayed.advance(1);
  assert.equal(delayed.root.hasAttribute('data-loading'), false);

  const explicit = createPage();
  explicit.runBoot();
  explicit.advance(2000);
  explicit.runRuntime();
  explicit.sds.loader.show();
  explicit.advance(2500);
  assert.equal(explicit.root.hasAttribute('data-loading'), true);
});

test('reveal observes unrevealed elements and marks them when they enter view', () => {
  const target = new ElementStub('section', { 'data-reveal': 'rise' });
  const previous = new ElementStub('section', { 'data-reveal': 'fade', 'data-revealed': '' });
  const page = createPage({ elements: [target, previous] });
  page.start();
  page.sds.reveal.init();
  assert.equal(page.observers.length, 1);
  const [observer] = page.observers;
  assert.deepEqual([...observer.observed], [target]);
  observer.notify(target, false);
  assert.equal(target.hasAttribute('data-revealed'), false);
  observer.notify(target, true);
  assert.equal(target.hasAttribute('data-revealed'), true);
  page.sds.reveal.init();
  assert.equal(observer.observed.size, 0);
});

test('reveal is a no-op with reduced motion, a native timeline or no observer', () => {
  for (const mode of ['reducedMotion', 'nativeReveal', 'noIntersectionObserver']) {
    const target = new ElementStub('section', { 'data-reveal': 'scale' });
    const page = createPage({ elements: [target], [mode]: true });
    page.start();
    page.sds.reveal.init();
    assert.equal(page.observers.length, 0, mode);
    assert.equal(target.hasAttribute('data-revealed'), false, mode);
  }
});

test('boot sets preferences before runtime and remains under 1.5 KB', () => {
  assert.ok(fs.statSync(path.join(designSystem, 'boot.js')).size < 1500);
  const storage = new Map([['sds.theme', 'dark'], ['sds.brand', 'forest-gold'], ['sds.lang', 'zh-Hans']]);
  const page = createPage({ storage, attributes: { lang: 'ms', 'data-default-brand': 'gjh-classic' } });
  const globals = Object.keys(page.win);
  page.runBoot();
  assert.deepEqual(Object.keys(page.win), globals);
  assert.deepEqual(['data-theme', 'data-brand', 'lang'].map(name => page.root.getAttribute(name)), ['dark', 'forest-gold', 'zh-Hans']);
  assert.equal(page.root.hasAttribute('data-loading'), true);
  page.start();
  assert.deepEqual([page.sds.theme.get(), page.sds.brand.get(), page.sds.lang.get()], ['dark', 'forest-gold', 'zh-Hans']);
  assert.deepEqual(Object.keys(page.win), [...globals, 'SDS']);
});

test('boot uses safe defaults for malformed storage, malformed markup and blocked access', () => {
  const storage = new Map([['sds.theme', 'night'], ['sds.brand', 'unknown'], ['sds.lang', 'zh']]);
  const malformed = createPage({ storage, attributes: { lang: '', 'data-default-brand': 'unknown' } });
  const blocked = createPage({ storageBlocked: true, attributes: { lang: 'ms', 'data-default-brand': 'gjh-classic' } });
  for (const [page, brand, lang] of [[malformed, 'none', 'en'], [blocked, 'gjh-classic', 'ms']]) {
    page.runBoot();
    assert.deepEqual(['data-theme', 'data-brand', 'lang'].map(name => page.root.getAttribute(name)), ['auto', brand, lang]);
    assert.equal(page.root.hasAttribute('data-loading'), true);
  }
});

test('boot and runtime apply the Chinese New Year brand in auto and light themes', () => {
  const brand = 'cny-red-gold';
  const control = new ElementStub('button', { 'data-sds-brand': brand });
  const page = createPage({ attributes: { 'data-default-brand': brand }, elements: [control] });
  page.runBoot();
  assert.equal(page.root.getAttribute('data-brand'), brand);
  assert.equal(page.root.getAttribute('data-theme'), 'auto');
  page.start();
  assert.equal(page.sds.brand.get(), brand);
  assert.equal(page.meta.getAttribute('content'), colors[brand].light);
  page.systemTheme(true);
  assert.equal(page.meta.getAttribute('content'), colors[brand].dark);
  page.sds.theme.set('light');
  assert.equal(page.meta.getAttribute('content'), colors[brand].light);

  page.sds.brand.set('none');
  assert.equal(control.getAttribute('aria-pressed'), 'false');
  page.dispatch('click', control);
  assert.equal(control.getAttribute('aria-pressed'), 'true');
  assert.equal(page.storage.get('sds.brand'), brand);
});

function serviceWorkerFixture() {
  const container = new EventTargetStub();
  const registration = new EventTargetStub();
  const ready = deferred();
  let registered = true;
  let checks = 0;
  let reloads = 0;
  let failCheck = false;
  const messages = [];
  registration.active = new EventTargetStub();
  registration.update = async () => {
    checks += 1;
    if (failCheck) throw new Error('Update check failed');
  };
  container.getRegistration = async () => registered ? registration : undefined;
  container.ready = ready.promise;
  const page = createPage({ serviceWorkers: container });
  page.win.location = { reload() { reloads += 1; } };

  return {
    page, container, registration, ready, messages,
    get checks() { return checks; },
    get reloads() { return reloads; },
    set registered(value) { registered = value; },
    set failCheck(value) { failCheck = value; },
    worker() {
      const worker = new EventTargetStub();
      worker.postMessage = message => messages.push({ ...message });
      return worker;
    }
  };
}

test('first installation stays silent until a replacement for the active worker is waiting', async () => {
  const fixture = serviceWorkerFixture();
  const { page, registration, ready } = fixture;
  const first = fixture.worker();
  registration.active = null;
  registration.installing = first;
  registration.waiting = first;
  const announcements = [];
  page.win.addEventListener('updateavailable', () => announcements.push(registration.waiting));
  page.runRuntime();
  page.domReady();
  ready.resolve(registration);
  await flush();
  await page.sds.update.apply();
  assert.deepEqual(fixture.messages, []);
  registration.active = first;
  first.dispatchEvent(new EventStub('statechange'));
  assert.deepEqual(announcements, []);
  const replacement = fixture.worker();
  registration.installing = replacement;
  registration.waiting = replacement;
  registration.dispatchEvent(new EventStub('updatefound'));
  assert.deepEqual(announcements, [replacement]);
});

test('already waiting updates are announced once and activate only on request with one reload', async () => {
  const fixture = serviceWorkerFixture();
  const { page, container, registration, ready, messages } = fixture;
  const changes = [];
  page.win.addEventListener('updateavailable', () => changes.push('window'));
  page.runRuntime();
  page.sds.on('updateavailable', () => changes.push('SDS'));
  registration.waiting = fixture.worker();
  page.domReady();
  ready.resolve(registration);
  await flush();
  assert.deepEqual(changes, ['window', 'SDS']);
  assert.deepEqual(messages, []);
  assert.equal(fixture.checks, 0);
  container.dispatchEvent(new EventStub('controllerchange'));
  assert.equal(fixture.reloads, 0);

  await page.sds.update.check();
  assert.equal(fixture.checks, 1);
  assert.deepEqual(changes, ['window', 'SDS']);
  await Promise.all([page.sds.update.apply(), page.sds.update.apply()]);
  assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(fixture.reloads, 0);
  container.dispatchEvent(new EventStub('controllerchange'));
  container.dispatchEvent(new EventStub('controllerchange'));
  assert.equal(fixture.reloads, 1);
});

test('a late service worker registration announces each new waiting installer once', async () => {
  const fixture = serviceWorkerFixture();
  fixture.registered = false;
  const { page, registration, ready } = fixture;
  page.start();
  await flush();
  await page.sds.update.apply();
  assert.deepEqual(fixture.messages, []);
  let offers = 0;
  page.sds.on('updateavailable', () => { offers += 1; });
  ready.resolve(registration);
  await flush();

  const first = fixture.worker();
  registration.installing = first;
  registration.dispatchEvent(new EventStub('updatefound'));
  first.dispatchEvent(new EventStub('statechange'));
  assert.equal(offers, 0);
  registration.waiting = first;
  registration.installing = null;
  first.dispatchEvent(new EventStub('statechange'));
  first.dispatchEvent(new EventStub('statechange'));
  assert.equal(offers, 1);

  const next = fixture.worker();
  registration.installing = next;
  registration.dispatchEvent(new EventStub('updatefound'));
  registration.waiting = next;
  registration.installing = null;
  next.dispatchEvent(new EventStub('statechange'));
  assert.equal(offers, 2);
});

test('update errors remain retryable and missing service worker support is a no-op', async () => {
  const unsupported = createPage();
  unsupported.start();
  await unsupported.sds.update.check();
  await unsupported.sds.update.apply();

  const fixture = serviceWorkerFixture();
  const { page, registration, container } = fixture;
  page.start();
  fixture.failCheck = true;
  await assert.rejects(page.sds.update.check(), /Update check failed/);
  fixture.failCheck = false;
  await page.sds.update.check();
  assert.equal(fixture.checks, 2);

  const waiting = fixture.worker();
  const postMessage = waiting.postMessage;
  waiting.postMessage = () => { throw new Error('Worker is unavailable'); };
  registration.waiting = waiting;
  await assert.rejects(page.sds.update.apply(), /Worker is unavailable/);
  container.dispatchEvent(new EventStub('controllerchange'));
  assert.equal(fixture.reloads, 0);
  waiting.postMessage = postMessage;
  await page.sds.update.apply();
  assert.deepEqual(fixture.messages, [{ type: 'SKIP_WAITING' }]);
});
