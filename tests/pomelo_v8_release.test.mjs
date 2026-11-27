// Exercise the real release code with deterministic worker events and timers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const demo = new URL('../demos/corporate/pomelo-stem/v8/', import.meta.url);
const source = path => readFileSync(new URL(path, demo), 'utf8')
  .replace(/^import .*?;\n/gm, '').replace(/^export /gm, '');
const generator = readFileSync(new URL('../scripts/build_pomelo_v8.py', import.meta.url), 'utf8');
const guard = generator.match(/SW_GUARD = r"""([\s\S]*?)"""/)[1];
const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}

class Events {
  listeners = new Map();
  addEventListener(type, listener, options = {}) {
    const list = this.listeners.get(type) || new Map();
    list.set(listener, options);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, event = {}) {
    for (const [listener, options] of [...(this.listeners.get(type) || [])]) {
      if (options.once) this.removeEventListener(type, listener);
      listener({type, ...event});
    }
  }
  count(type) { return this.listeners.get(type)?.size || 0; }
}

function clock() {
  const timers = new Map();
  let next = 0;
  let now = 1000;
  return {
    Date: class extends Date { static now() { return now; } },
    advance(ms) { now += ms; },
    setTimeout(fn, delay) { timers.set(++next, {fn, delay}); return next; },
    clearTimeout(id) { timers.delete(id); },
    fire(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) { timers.delete(id); timer.fn(); }
      }
    },
  };
}

test('unsaved controls include outside forms and honor the nearest persistence rule', () => {
  let fields = [];
  const document = {querySelectorAll(selector) {
    assert.equal(selector, '[data-dirty="true"], input, textarea, select');
    return fields;
  }};
  const hasUnsavedInput = vm.runInNewContext(source('assets/js/core/unsaved.js') + '\nhasUnsavedInput', {document});
  const field = (attrs = {}, rule) => ({
    tagName: 'INPUT', type: 'text', value: '', defaultValue: '',
    getAttribute: name => attrs[name],
    closest: () => rule ? {getAttribute: () => rule} : null,
    ...attrs,
  });
  const check = (input, dirty) => { fields = [input]; assert.equal(hasUnsavedInput(), dirty); };
  check(field(), false);
  check(field({value: 'Restored outside a form'}), true);
  check(field({tagName: 'TEXTAREA', value: 'Draft'}), true);
  check(field({type: 'checkbox', checked: true, defaultChecked: false}), true);
  check(field({type: 'radio', checked: false, defaultChecked: true}), true);
  check(field({'data-dirty': 'true'}), true);
  check(field({'data-dirty': 'true', value: 'Saved'}, 'ignore'), false);
  check(field({type: 'checkbox', checked: true, defaultChecked: false}, 'ignore'), false);
  check(field({value: 'Explicit override'}, 'track'), true);
  const option = (attrs = {}) => ({selected: false, defaultSelected: false, disabled: false,
    parentElement: {tagName: 'SELECT'}, ...attrs});
  check(field({tagName: 'SELECT', selectedIndex: 0, options: [option(), option()]}), false);
  check(field({tagName: 'SELECT', selectedIndex: 1, options: [option(), option()]}), true);
  check(field({tagName: 'SELECT', selectedIndex: 1, options: [option({disabled: true}), option()]}), false);
  check(field({tagName: 'SELECT', multiple: true, options: [option({selected: true})]}), true);
});

function domHarness() {
  const document = new Events();
  class Element extends Events {
    constructor(tag) {
      super();
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attributes = {};
      this.dataset = {};
      this.inert = false;
      this.offsetParent = {};
      const classes = new Set();
      this.classList = {add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name)};
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
      if (name === 'class') this.className = value;
    }
    getAttribute(name) { return this.attributes[name]; }
    cloneNode(deep) {
      const copy = new Element(this.tagName);
      copy.attributes = {...this.attributes};
      copy.className = this.className;
      copy.textContent = this.textContent;
      if (deep) copy.append(...this.children.map(node => node.cloneNode(true)));
      return copy;
    }
    append(...nodes) {
      for (const node of nodes) { this.children.push(node); node.parentElement = this; }
    }
    remove() { this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
    get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
    closest() { return this.inert ? this : this.parentElement?.closest() || null; }
    contains(target) { return this === target || this.children.some(node => node.contains(target)); }
    focus() { document.activeElement = this; }
    matches(selector) {
      return selector.split(', ').some(part => Object.hasOwn(this.attributes, part.slice(1, -1)));
    }
    querySelectorAll() {
      const nodes = this.children.flatMap(node => [node, ...node.querySelectorAll()]);
      return nodes.filter(node => ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName));
    }
    querySelector(selector) {
      const nodes = this.querySelectorAll();
      return selector === '[data-autofocus]' ? nodes.find(node => Object.hasOwn(node.dataset, 'autofocus')) : nodes[0];
    }
  }
  document.createElement = tag => new Element(tag);
  document.createElementNS = (ns, tag) => {
    assert.equal(ns, 'http://www.w3.org/2000/svg');
    return new Element(tag);
  };
  document.body = new Element('body');
  const mark = new Element('svg');
  mark.className = 'loader__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('focusable', 'false');
  mark.setAttribute('viewBox', '0 0 1024 1024');
  mark.append(new Element('path'));
  document.querySelector = selector => selector === '#page-loader .loader__mark' ? mark : null;
  return {document, Element};
}

function updateHarness({registration = null, hasWorker = true, locale} = {}) {
  const timers = clock();
  const sw = new Events();
  sw.getRegistration = async () => registration;
  const {document, Element} = domHarness();
  const button = new Element('button');
  button.querySelector = () => ({});
  document.body.append(button);
  button.focus();
  const state = {dirty: false, reloads: 0, confirms: [], answer: true, toasts: []};
  const pageMark = document.querySelector('#page-loader .loader__mark');
  const strings = locale ? JSON.parse(source(`i18n/${locale}.json`)) : {};
  const context = {
    ...timers, URL, navigator: hasWorker ? {serviceWorker: sw} : {},
    document: Object.assign(document, {baseURI: 'https://example.test/v8/', querySelector(selector) {
      if (selector === '#page-loader .loader__mark') return pageMark;
      if (selector === '[data-update]') return button;
      if (selector === '[data-update-status]') return {};
      return {content: selector.includes('root') ? './' : '8.2.4'};
    }}),
    window: {scrollTo() {}, location: {reload() { if (state.reloadError) throw new Error('Navigation failed'); state.reloads += 1; }}}, location: {protocol: 'file:'},
    t: key => strings[key] ?? key, toast: options => state.toasts.push(options), hasUnsavedInput: () => state.dirty,
    confirm(options) { state.confirms.push(options); return Promise.resolve(state.answer); },
  };
  const api = vm.runInNewContext('const mount = (() => {\n' + source('assets/js/core/dialog.js') + '\nreturn mount; })();\n' + source('assets/js/core/loader.js') +
    `\nconst showLoader = (...args) => {
      if (loaderState.showError) throw new Error('Loader show failed');
      const handle = show(...args);
      return {close() { handle.close(); if (loaderState.closeError) throw new Error('Loader close failed'); }};
    };\n` + source('assets/js/core/update.js') + '\ninit(); ({apply})', {...context, loaderState: state});
  return {...timers, ...api, state, button, sw, document, Element,
    get loader() { return document.body.children.find(node => Object.hasOwn(node.attributes, 'data-update-loader')); }};
}

function waitingRegistration() {
  const worker = new Events();
  worker.messages = [];
  worker.postMessage = message => worker.messages.push(message);
  return {waiting: worker, update: async () => {}};
}

test('update timeout removes its controller listener and ignores late changes', async () => {
  const registration = waitingRegistration();
  const h = updateHarness({registration});
  await h.apply();
  assert.ok(h.loader);
  assert.equal(h.sw.count('controllerchange'), 1);
  h.fire(12000);
  assert.equal(h.button.dataset.state, 'error');
  assert.equal(h.button.disabled, false);
  assert.equal(h.loader, undefined);
  assert.equal(h.document.activeElement, h.button);
  assert.equal(h.state.toasts.at(-1).messageKey, 'toast.updateError.title');
  assert.equal(h.sw.count('controllerchange'), 0);
  h.sw.emit('controllerchange');
  await flush();
  assert.equal(h.state.reloads, 0);
  await h.apply();
  h.sw.emit('controllerchange');
  h.sw.emit('controllerchange');
  await flush();
  assert.equal(h.state.reloads, 1);
});

test('timed out registration, update and installation continuations cannot reload', async () => {
  for (const stage of ['registration', 'update', 'installation']) {
    const pending = deferred();
    const registration = waitingRegistration();
    if (stage === 'update') registration.update = () => pending.promise;
    if (stage === 'installation') {
      registration.waiting = null;
      registration.installing = new Events();
    }
    const h = updateHarness({registration});
    if (stage === 'registration') h.sw.getRegistration = () => pending.promise;
    const applying = h.apply();
    await flush();
    h.fire(12000);
    pending.resolve(stage === 'registration' ? null : undefined);
    if (stage === 'installation') {
      registration.installing.state = 'installed';
      registration.installing.emit('statechange');
    }
    await applying;
    h.sw.emit('controllerchange');
    await flush();
    assert.equal(h.button.dataset.state, 'error', stage);
    assert.equal(h.loader, undefined, stage);
    assert.equal(h.sw.count('controllerchange'), 0, stage);
    assert.equal(h.state.reloads, 0, stage);
  }
});

test('new dirty input during update can decline reload and apply again later', async () => {
  for (const usesController of [false, true]) {
    const pending = deferred();
    const registration = usesController ? waitingRegistration() : null;
    const h = updateHarness({registration});
    h.sw.getRegistration = () => pending.promise;
    const applying = h.apply();
    await flush();
    assert.ok(h.loader);
    h.state.dirty = true;
    h.state.answer = false;
    pending.resolve(registration);
    await applying;
    if (usesController) h.sw.emit('controllerchange');
    await flush();
    assert.equal(h.state.confirms.length, 1);
    assert.equal(h.state.confirms[0].title, 'update.unsavedTitle');
    assert.equal(h.state.confirms[0].body, 'update.unsavedBody');
    assert.equal(h.state.confirms[0].confirmLabel, 'update.apply');
    assert.equal(h.state.reloads, 0);
    assert.equal(h.button.dataset.state, 'available');
    assert.equal(h.button.disabled, false);
    assert.equal(h.loader, undefined);
    assert.equal(h.document.activeElement, h.button);
    h.sw.emit('controllerchange');
    h.fire(12000);
    assert.equal(h.state.reloads, 0);
    h.state.answer = true;
    await h.apply();
    h.sw.emit('controllerchange');
    h.sw.emit('controllerchange');
    await flush();
    assert.equal(h.state.reloads, 1);
    assert.equal(h.state.confirms.length, 3); // Initial consent and final consent on retry.
  }
});

test('update loader has modal semantics, blocks all controls, traps Tab and ignores Escape', async () => {
  const h = updateHarness({registration: waitingRegistration()});
  const region = new h.Element('div');
  region.setAttribute('data-toast-region', '');
  const inert = new h.Element('aside');
  inert.inert = true;
  h.document.body.append(region, inert);
  await h.apply();
  const panel = h.loader.children[0];
  assert.equal(panel.getAttribute('role'), 'alertdialog');
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  assert.equal(panel.tabIndex, -1);
  const [brand, indicator, status] = panel.children;
  const [mark, tagline] = brand.children;
  assert.equal(mark.tagName, 'SVG');
  assert.equal(mark.className, 'loader__mark');
  assert.equal(mark.getAttribute('aria-hidden'), 'true');
  assert.equal(mark.getAttribute('focusable'), 'false');
  assert.notEqual(mark, h.document.querySelector('#page-loader .loader__mark'));
  assert.equal(mark.children.length, 1);
  assert.equal(tagline.className, 'loader__tagline');
  assert.equal(tagline.textContent, 'loader.tagline');
  assert.equal(indicator.getAttribute('aria-hidden'), 'true');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(panel.getAttribute('aria-labelledby'), status.children[0].id);
  assert.equal(panel.getAttribute('aria-describedby'), status.children[1].id);
  assert.equal(h.document.activeElement, panel);
  assert.equal(h.button.inert, true);
  assert.equal(region.inert, true);
  for (const shiftKey of [true, false]) {
    let prevented = false;
    h.document.emit('keydown', {key: 'Tab', shiftKey, preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    assert.equal(h.document.activeElement, panel);
  }
  h.document.emit('keydown', {key: 'Escape', stopPropagation() {}});
  assert.ok(h.loader);
  h.fire(12000);
  assert.equal(region.inert, false);
  assert.equal(inert.inert, true);
  assert.equal(h.document.body.classList.contains('is-locked'), false);
  assert.equal(h.document.activeElement, h.button);
});

test('update loader uses the localized brand tagline in every language', async () => {
  for (const [locale, expected] of Object.entries({en: 'Growing Smarter Solutions.', zh: '智慧方案，伴你成长。',
    ms: 'Penyelesaian pintar untuk terus berkembang.'})) {
    const h = updateHarness({registration: waitingRegistration(), locale});
    await h.apply();
    const brand = h.loader.children[0].children[0];
    assert.equal(brand.children[1].textContent, expected, locale);
    assert.equal(brand.children[0].getAttribute('aria-hidden'), 'true', locale);
    h.fire(12000);
  }
});

test('initial unsaved consent never shows a loader until accepted and decline leaves none', async () => {
  const h = updateHarness({registration: waitingRegistration()});
  const answer = deferred();
  h.state.dirty = true;
  h.state.answer = answer.promise;
  const applying = h.apply();
  await flush();
  assert.equal(h.loader, undefined);
  answer.resolve(false);
  await applying;
  assert.equal(h.loader, undefined);
  assert.equal(h.state.reloads, 0);
  h.state.answer = true;
  await h.apply();
  assert.ok(h.loader);
});

test('worker errors and failed or blocked navigation clear the loader and permit retry', async () => {
  const registration = waitingRegistration();
  registration.update = async () => { throw new Error('Offline'); };
  const error = updateHarness({registration});
  await error.apply();
  assert.equal(error.loader, undefined);
  assert.equal(error.button.dataset.state, 'error');
  const h = updateHarness({hasWorker: false});
  h.state.reloadError = true;
  await h.apply();
  assert.equal(h.loader, undefined);
  assert.equal(h.document.activeElement, h.button);
  h.state.reloadError = false;
  await h.apply();
  assert.ok(h.loader);
  assert.equal(h.state.reloads, 1);
  h.fire(12000); // Simulate a reload that did not navigate.
  assert.equal(h.loader, undefined);
  await h.apply();
  assert.equal(h.state.reloads, 2);
});

test('mixed-cache HTML without a loader mark uses the complete fallback and apply remains retryable', async () => {
  const h = updateHarness({registration: waitingRegistration()});
  const query = h.document.querySelector;
  h.document.querySelector = selector => selector === '#page-loader .loader__mark' ? null : query(selector);
  await h.apply();
  const mark = h.loader.children[0].children[0].children[0];
  assert.equal(mark.tagName, 'SVG');
  assert.equal(mark.getAttribute('viewBox'), '0 0 1024 1024');
  assert.equal(mark.getAttribute('aria-hidden'), 'true');
  assert.equal(mark.getAttribute('focusable'), 'false');
  assert.equal(mark.children[0].getAttribute('transform'), 'translate(512 505) scale(.985) translate(-469 -500)');
  const parts = mark.children[0].children[0].children;
  assert.equal(parts.filter(node => node.tagName === 'PATH').length, 10);
  assert.equal(parts.filter(node => node.tagName === 'CIRCLE').length, 3);
  h.fire(12000);
  assert.equal(h.button.dataset.state, 'error');
  assert.equal(h.button.disabled, false);
  assert.equal(h.document.activeElement, h.button);
  await h.apply();
  h.sw.emit('controllerchange');
  await flush();
  assert.equal(h.state.reloads, 1);
});

test('loader show, re-show and close failures restore update state and focus, including worker events', async () => {
  for (const stage of ['show', 're-show', 'close', 'failure-close']) {
    const h = updateHarness({registration: waitingRegistration()});
    h.state.showError = stage === 'show';
    await h.apply();
    if (stage !== 'show') {
      h.state.dirty = true;
      h.state.showError = stage === 're-show';
      h.state.closeError = stage.endsWith('close');
      if (stage === 'failure-close') h.fire(12000);
      else h.sw.emit('controllerchange');
      await flush();
    }
    assert.equal(h.button.dataset.state, 'error', stage);
    assert.equal(h.button.disabled, false, stage);
    assert.equal(h.loader, undefined, stage);
    assert.equal(h.document.activeElement, h.button, stage);
    assert.equal(h.state.toasts.at(-1).messageKey, 'toast.updateError.title', stage);
    h.state.showError = h.state.closeError = h.state.dirty = false;
    await h.apply();
    h.sw.emit('controllerchange');
    await flush();
    assert.equal(h.state.reloads, 1, stage);
  }
});

function pageLoaderHarness({run = true, busy = null, lateBody = false} = {}) {
  const {document, Element} = domHarness();
  const timers = clock();
  const window = new Events();
  const main = new Element('main');
  main.removeAttribute = name => { delete main.attributes[name]; };
  main.getAttribute = name => main.attributes[name] ?? null;
  if (busy !== null) main.setAttribute('aria-busy', busy);
  const loader = new Element('div');
  loader.hidden = true;
  document.body.append(main, loader);
  const opener = new Element('a');
  opener.focus();
  const body = document.body;
  let parsed = !lateBody;
  if (lateBody) document.body = null;
  document.getElementById = id => parsed ? (id === 'main' ? main : loader) : null;
  let observer;
  class MutationObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  if (run) vm.runInNewContext(source('assets/js/core/loader-boot.js'), {...timers, window, document, MutationObserver});
  return {...timers, window, document, main, loader, opener,
    get observing() { return observer?.active || false; },
    parseBody() { parsed = true; document.body = body; if (observer?.active) observer.callback(); }};
}

test('page loader never flashes when ready before 400ms or when JavaScript is disabled', () => {
  for (const event of ['DOMContentLoaded', 'load', 'app']) {
    const h = pageLoaderHarness();
    if (event === 'app') h.window.__pomeloV8PageReady();
    else (event === 'load' ? h.window : h.document).emit(event);
    h.fire(400);
    assert.equal(h.loader.hidden, true, event);
    assert.equal(h.main.getAttribute('aria-busy'), null, event);
    assert.equal(h.document.body.classList.contains('is-loading'), false, event);
  }
  const noJS = pageLoaderHarness({run: false});
  noJS.fire(400);
  noJS.fire(8000);
  assert.equal(noJS.loader.hidden, true);
});

test('delayed page loader shows without focus theft and ready, bfcache or safety always clears it', () => {
  for (const finish of ['DOMContentLoaded', 'load', 'app', 'pageshow', 'pagehide', 'timeout']) {
    for (const busy of [null, 'false']) {
      const h = pageLoaderHarness({busy});
      assert.equal(h.loader.hidden, true);
      h.fire(400);
      assert.equal(h.loader.hidden, false);
      assert.equal(h.main.getAttribute('aria-busy'), 'true');
      assert.equal(h.document.activeElement, h.opener);
      assert.equal(h.document.body.classList.contains('is-loading'), true);
      if (finish === 'timeout') h.fire(8000);
      else if (finish === 'app') h.window.__pomeloV8PageReady();
      else (finish === 'DOMContentLoaded' ? h.document : h.window).emit(finish);
      h.window.emit('pageshow');
      h.fire(400);
      assert.equal(h.loader.hidden, true, finish);
      assert.equal(h.main.getAttribute('aria-busy'), busy, finish);
      assert.equal(h.document.body.classList.contains('is-loading'), false, finish);
      assert.equal(h.document.activeElement, h.opener);
    }
  }
});

test('late body shows after the threshold and every ready path cancels markup observation', () => {
  for (const finish of ['DOMContentLoaded', 'load', 'app', 'pageshow', 'pagehide', 'timeout']) {
    for (const beforeBody of [false, true]) {
      const h = pageLoaderHarness({lateBody: true, busy: 'false'});
      h.fire(400);
      assert.equal(h.observing, true);
      if (!beforeBody) {
        h.parseBody();
        assert.equal(h.loader.hidden, false);
        assert.equal(h.main.getAttribute('aria-busy'), 'true');
        assert.equal(h.observing, false);
      }
      if (finish === 'timeout') h.fire(8000);
      else if (finish === 'app') h.window.__pomeloV8PageReady();
      else (finish === 'DOMContentLoaded' ? h.document : h.window).emit(finish);
      if (beforeBody) h.parseBody();
      assert.equal(h.loader.hidden, true, finish);
      assert.equal(h.observing, false, finish);
      assert.equal(h.main.getAttribute('aria-busy'), 'false', finish);
      assert.equal(h.document.body.classList.contains('is-loading'), false, finish);
      assert.equal(h.document.activeElement, h.opener, finish);
    }
  }
});

test('repeated apply or controller changes cannot duplicate final consent or reload', async () => {
  const h = updateHarness({registration: waitingRegistration()});
  await h.apply();
  const answer = deferred();
  h.state.dirty = true;
  h.state.answer = answer.promise;
  h.sw.emit('controllerchange');
  h.sw.emit('controllerchange');
  await h.apply();
  assert.equal(h.state.confirms.length, 1);
  answer.resolve(true);
  await flush();
  assert.equal(h.state.reloads, 1);
  const fallback = updateHarness({hasWorker: false});
  await fallback.apply();
  assert.equal(fallback.state.reloads, 1);
});

function healHarness({storage = new Map(), offline = false, fail = false, dirty = false, build = 'old'} = {}) {
  const timers = clock();
  const sw = new Events();
  const window = new Events();
  const state = {updates: 0, reloads: 0, fail, dirty, build};
  sw.controller = {postMessage(message, ports) {
    assert.equal(message.type, 'GET_BUILD');
    const port = ports[0].peer;
    if (state.deferVerification) { state.reply = () => port.onmessage({data: {build: state.build}}); return; }
    if (!port.closed) port.onmessage({data: {build: state.build}});
  }};
  const worker = {postMessage() {}};
  sw.getRegistration = async () => ({waiting: worker, async update() {
    state.updates += 1;
    if (state.fail) throw new Error('Offline');
  }});
  const navigator = {serviceWorker: sw, onLine: !offline};
  class MessageChannel {
    constructor() {
      this.port1 = {close() { this.closed = true; }};
      this.port2 = {peer: this.port1};
    }
  }
  window.MessageChannel = MessageChannel;
  const document = {querySelector: () => ({content: 'wanted'}),
    querySelectorAll: () => state.dirty ? [{closest: () => null, getAttribute: () => 'true'}] : []};
  const location = {protocol: 'file:', reload() {
    if (state.reloadError) throw new Error('Navigation failed');
    state.reloads += 1;
  }};
  window.location = location;
  const context = vm.createContext({...timers, window, navigator, document, MessageChannel, location,
    sessionStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
  });
  vm.runInContext(guard, context);
  return {...timers, window, navigator, sw, state, storage, context};
}

function manualAlongsideHeal(h) {
  const button = {dataset: {}, classList: {add() {}, remove() {}},
    querySelector: () => ({}), setAttribute() {}, addEventListener() {}, focus() {}};
  h.context.document.baseURI = 'https://example.test/v8/';
  h.context.document.querySelector = selector => {
    if (selector === '[data-update]') return button;
    if (selector === '[data-update-status]') return {};
    return {content: selector.includes('root') ? './' : 'wanted'};
  };
  Object.assign(h.context, {URL, t: key => key, toast() {}, confirm: async () => false, showLoader: () => ({close() {}})});
  return vm.runInContext(source('assets/js/core/unsaved.js') + '\n' + source('assets/js/core/update.js') + '\ninit(); ({apply, button})', h.context);
}

test('self-heal and manual update coordinate one reload whichever path finishes first', async () => {
  for (const manualFirst of [false, true]) {
    const h = healHarness();
    await flush();
    await manualAlongsideHeal(h).apply();
    assert.equal(h.sw.count('controllerchange'), 2);
    h.state.build = 'wanted';
    h.state.deferVerification = manualFirst;
    h.sw.emit('controllerchange');
    await flush();
    if (manualFirst) h.state.reply();
    await flush();
    assert.equal(h.window.__pomeloV8Reloading.owner, manualFirst ? 'update' : 'self-heal');
    assert.equal(typeof h.window.__pomeloV8Reloading.timestamp, 'number');
    assert.equal(h.state.reloads, 1);
    assert.equal(h.sw.count('controllerchange'), 0);
  }
});

test('both reload paths preserve input entered while their shared update is waiting', async () => {
  const h = healHarness();
  await flush();
  await manualAlongsideHeal(h).apply();
  h.state.dirty = true;
  h.state.build = 'wanted';
  h.sw.emit('controllerchange');
  await flush();
  assert.equal(h.state.reloads, 0);
  assert.equal(h.window.__pomeloV8Reloading, undefined);
});

test('ignored or throwing self-heal navigation releases its claim so manual update reloads once', async () => {
  for (const recovery of ['watchdog', 'stale', 'throw']) {
    const h = healHarness();
    await flush();
    h.state.build = 'wanted';
    h.state.reloadError = recovery === 'throw';
    h.sw.emit('controllerchange');
    assert.equal(h.state.reloads, recovery === 'throw' ? 0 : 1);
    if (recovery === 'watchdog') h.fire(3000);
    if (recovery === 'stale') h.advance(3000); // Timer delivery may be throttled.
    else assert.equal(h.window.__pomeloV8Reloading, undefined, recovery);
    h.state.reloadError = false;
    const manual = manualAlongsideHeal(h);
    const before = h.state.reloads;
    await manual.apply();
    h.sw.emit('controllerchange');
    h.sw.emit('controllerchange');
    await manual.apply();
    await flush();
    assert.equal(h.state.reloads - before, 1, recovery);
    assert.equal(h.window.__pomeloV8Reloading.owner, 'update', recovery);
    h.fire(3000);
    assert.equal(h.window.__pomeloV8Reloading, undefined, recovery);
  }
});

test('claim watchdogs and failure cleanup never release another owner', async () => {
  const h = healHarness();
  await flush();
  h.state.build = 'wanted';
  h.sw.emit('controllerchange');
  const replacement = {owner: 'update', timestamp: 5000};
  h.window.__pomeloV8Reloading = replacement;
  h.fire(3000);
  assert.equal(h.window.__pomeloV8Reloading, replacement);
  delete h.window.__pomeloV8Reloading;
  const manual = manualAlongsideHeal(h);
  await manual.apply();
  h.sw.emit('controllerchange');
  await flush();
  const next = {owner: 'self-heal', timestamp: 6000};
  h.window.__pomeloV8Reloading = next;
  h.fire(3000);
  h.fire(12000);
  assert.equal(h.window.__pomeloV8Reloading, next);
  assert.equal(manual.button.dataset.state, 'error');
  assert.equal(manual.button.disabled, false);
});

test('self-heal respects a fresh manual claim and can take over an expired one', async () => {
  for (const stale of [false, true]) {
    const h = healHarness();
    await flush();
    const claim = {owner: 'update', timestamp: h.Date.now()};
    h.window.__pomeloV8Reloading = claim;
    if (stale) h.advance(3000);
    h.state.build = 'wanted';
    h.sw.emit('controllerchange');
    assert.equal(h.state.reloads, stale ? 1 : 0);
    if (stale) assert.equal(h.window.__pomeloV8Reloading.owner, 'self-heal');
    else assert.equal(h.window.__pomeloV8Reloading, claim);
  }
});

test('failed offline heal retries online and marks success only after controller verification', async () => {
  const h = healHarness({offline: true, fail: true});
  await flush();
  assert.equal(h.state.updates, 1);
  assert.equal(h.storage.has('pomelo-v8-heal'), false);
  assert.equal(h.sw.count('controllerchange'), 0);
  h.state.fail = false;
  h.navigator.onLine = true;
  h.window.emit('online');
  await flush();
  assert.equal(h.state.updates, 2);
  assert.equal(h.storage.has('pomelo-v8-heal'), false);
  h.state.build = 'wanted';
  h.sw.emit('controllerchange');
  assert.equal(h.storage.get('pomelo-v8-heal'), 'wanted');
  assert.equal(h.state.reloads, 1);
  h.sw.emit('controllerchange');
  h.window.emit('online');
  await flush();
  assert.equal(h.state.reloads, 1);
  assert.equal(h.state.updates, 2);
});

test('heal attempts are capped across page loads and reset for a different build', async () => {
  const storage = new Map();
  for (let page = 0; page < 3; page += 1) {
    const h = healHarness({storage, offline: true, fail: true});
    await flush();
    assert.equal(h.state.updates, page < 2 ? 1 : 0);
    assert.equal(storage.has('pomelo-v8-heal'), false);
  }
  const previousBuild = new Map([['pomelo-v8-heal-attempts:previous', '2']]);
  const h = healHarness({storage: previousBuild});
  await flush();
  assert.equal(h.state.updates, 1);
  assert.equal(previousBuild.get('pomelo-v8-heal-attempts:previous'), '2');
  assert.equal(previousBuild.get('pomelo-v8-heal-attempts:wanted'), '1');
});

test('heal timeout removes late reloads and bounds automatic retries', async () => {
  const h = healHarness();
  await flush();
  h.fire(12000);
  h.state.build = 'wanted';
  h.sw.emit('controllerchange');
  assert.equal(h.state.reloads, 0);
  h.fire(1000);
  await flush();
  h.fire(12000);
  h.fire(1000);
  h.window.emit('online');
  await flush();
  assert.equal(h.state.updates, 2);
  assert.equal(h.state.reloads, 0);
  assert.equal(h.storage.has('pomelo-v8-heal'), false);
});

test('successful heal preserves newly dirty input and refuses an incorrect controller build', async () => {
  const dirty = healHarness();
  await flush();
  dirty.state.dirty = true;
  dirty.state.build = 'wanted';
  dirty.sw.emit('controllerchange');
  assert.equal(dirty.state.reloads, 0);
  assert.equal(dirty.storage.get('pomelo-v8-heal'), 'wanted');
  const wrong = healHarness();
  await flush();
  wrong.sw.emit('controllerchange');
  assert.equal(wrong.state.reloads, 0);
  assert.equal(wrong.storage.has('pomelo-v8-heal'), false);
});

test('dialogs describe their body, keep toast announcements active and restore inert state', async () => {
  const {document, Element} = domHarness();
  const main = new Element('main');
  const existingInert = new Element('aside');
  existingInert.inert = true;
  const region = new Element('div');
  region.setAttribute('data-toast-region', '');
  const status = new Element('div');
  status.setAttribute('data-toast-live', '');
  status.setAttribute('role', 'status');
  const alert = new Element('div');
  alert.setAttribute('data-toast-live', '');
  alert.setAttribute('role', 'alert');
  const opener = new Element('button');
  document.body.append(main, existingInert, region, status, alert, opener, new Element('script'));
  opener.focus();
  const scrolls = [];
  const {open, confirm, show} = vm.runInNewContext(source('assets/js/core/dialog.js') + '\n' +
    source('assets/js/core/loader.js') + '\n({open, confirm, show})', {
    document, window: {scrollY: 240, scrollTo(...args) { scrolls.push(args); }}, t: key => key, icon: () => new Element('svg'),
  });
  const content = new Element('p');
  content.textContent = 'Description';
  const handle = open({title: 'Dialog', content});
  assert.equal(handle.panel.getAttribute('aria-describedby'), content.id);
  assert.ok(content.id);
  assert.equal(main.inert, true);
  for (const node of [region, status, alert]) assert.equal(node.inert, false);
  let prevented = false;
  region.focus();
  document.emit('keydown', {key: 'Tab', preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(handle.panel.contains(document.activeElement), true);
  const inner = open({title: 'Update', content: new Element('p')});
  assert.equal(handle.panel.parentElement.inert, true);
  assert.equal(inner.panel.parentElement.inert, false);
  inner.close();
  assert.equal(document.body.classList.contains('is-locked'), true);
  assert.equal(handle.panel.parentElement.inert, false);
  assert.equal(main.inert, true);
  assert.equal(existingInert.inert, true);
  assert.equal(scrolls.length, 0);
  assert.equal(handle.panel.contains(document.activeElement), true);
  const loading = show({title: 'Updating', detail: 'Reloading soon', returnFocus: opener});
  assert.equal(handle.panel.parentElement.inert, true);
  assert.equal(region.inert, true);
  loading.close();
  assert.equal(handle.panel.parentElement.inert, false);
  assert.equal(main.inert, true);
  assert.equal(region.inert, false);
  assert.equal(document.body.classList.contains('is-locked'), true);
  assert.equal(handle.panel.contains(document.activeElement), true);
  handle.close();
  assert.equal(document.activeElement, opener);
  assert.equal(main.inert, false);
  assert.equal(existingInert.inert, true);
  for (const node of [region, status, alert]) assert.equal(node.inert, false);
  assert.equal(document.count('keydown'), 0);
  assert.equal(document.body.classList.contains('is-locked'), false);
  assert.deepEqual(scrolls, [[0, 240]]);

  const lower = open({title: 'Lower'});
  const upper = open({title: 'Upper'});
  lower.close(); // Closing out of order must not restore the page under the top dialog.
  assert.equal(main.inert, true);
  assert.equal(upper.panel.parentElement.inert, false);
  assert.equal(document.body.classList.contains('is-locked'), true);
  upper.close();
  assert.equal(main.inert, false);
  assert.equal(existingInert.inert, true);
  document.body.classList.add('is-locked');
  open({title: 'Already locked'}).close();
  assert.equal(document.body.classList.contains('is-locked'), true);
  document.body.classList.remove('is-locked');

  const result = confirm({title: 'Confirm', body: 'Keep this draft?'});
  const panel = document.body.children.at(-1).children[0];
  const text = panel.children[1].children[0];
  assert.equal(text.tagName, 'P');
  assert.ok(text.id);
  assert.notEqual(text.id, content.id);
  assert.equal(panel.getAttribute('aria-describedby'), text.id);
  panel.children[2].children[0].emit('click');
  assert.equal(await result, false);
  assert.equal(main.inert, false);
  assert.equal(existingInert.inert, true);
});

test('contact init enables submission, hides the fallback and reverting clears unsaved input', () => {
  const form = new Events();
  const fields = ['INPUT', 'INPUT', 'TEXTAREA'].map((tagName, index) => ({
    tagName, value: '', defaultValue: '', required: index !== 1,
    getAttribute: () => null, removeAttribute() {}, closest: () => null,
  }));
  const submit = {disabled: true};
  const fallback = {hidden: false};
  form.querySelector = selector => selector === '[data-form-fallback]' ? fallback : submit;
  const document = {
    querySelector: selector => selector === '[data-contact-form]' ? form : null,
    querySelectorAll: () => fields, getElementById: () => null,
  };
  const api = vm.runInNewContext(source('assets/js/core/unsaved.js') + '\n' +
    source('assets/js/components/contact-form.js') + '\ninit(); ({hasUnsavedInput})', {document});
  assert.equal(submit.disabled, false);
  assert.equal(fallback.hidden, true);
  assert.equal(api.hasUnsavedInput(), false);
  for (const field of fields) {
    field.value = 'Draft';
    form.emit('input', {target: field});
    assert.equal(api.hasUnsavedInput(), true);
    field.value = field.defaultValue;
    form.emit('input', {target: field});
    assert.equal(api.hasUnsavedInput(), false);
  }
});

test('commerce statuses follow the paid order and an empty prep checklist never means ready', () => {
  const root = new Events();
  root.dataset = {};
  const studio = new Events();
  const boxes = ['prep-1', 'prep-2', 'prep-3'].map(id => ({
    id, checked: false, defaultChecked: false, type: 'checkbox',
    getAttribute: () => null, closest: () => null, matches: () => true,
  }));
  const steps = ['paid', 'packed', 'collected'].map(name => ({
    dataset: {step: name}, done: false, status: {textContent: ''},
    querySelector() { return this.status; },
    get classList() { return {toggle: (name, done) => { this.done = done; }}; },
  }));
  root.querySelectorAll = selector => selector === '.product__price' ? [] : steps;
  const nodes = {};
  root.querySelector = selector => nodes[selector] ||= {replaceChildren() {}, append() {}};
  studio.querySelectorAll = () => boxes;
  const document = {
    querySelector: selector => selector === '[data-commerce-demo]' ? root : studio,
    querySelectorAll: () => boxes,
    createElement: () => ({append() {}}),
  };
  const toasts = [];
  const api = vm.runInNewContext(source('assets/js/core/unsaved.js') + '\n' +
    source('assets/js/store/demo-store.js') + '\n' + source('assets/js/components/commerce-demo.js') +
    '\ninit(); ({hasUnsavedInput, addItem, subscribe})',
    {document, formatPrice: String, t: key => key, toast: options => toasts.push(options)});
  let state;
  api.subscribe(value => { state = value; });
  const check = (box, checked) => { box.checked = checked; studio.emit('input', {target: box}); };
  assert.equal(api.hasUnsavedInput(), false);
  assert.ok(steps.every(step => step.status.textContent === 'pickup.status.pending'));
  for (const box of boxes) check(box, true);
  assert.equal(state.steps.paid, false);
  assert.equal(state.steps.packed, false);
  assert.equal(toasts.at(-1).messageKey, 'toast.studioDone.detail');
  assert.equal(toasts.at(-1).detailKey, undefined);
  assert.ok(steps.every(step => !step.done));
  for (const box of boxes) check(box, false);
  assert.equal(api.hasUnsavedInput(), false);
  api.addItem('mug', 'Mug', 35);
  assert.equal(state.steps.paid, true);
  assert.equal(state.steps.packed, false);
  assert.equal(steps[0].status.textContent, 'pickup.status.done');
  for (const box of boxes) check(box, true);
  assert.equal(state.steps.packed, true);
  assert.equal(steps[1].status.textContent, 'pickup.status.done');
  assert.equal(steps[2].status.textContent, 'pickup.status.pending');
  assert.equal(toasts.at(-1).messageKey, 'toast.studioDone.title');
  check(boxes[0], false);
  assert.equal(state.steps.packed, false);
  assert.equal(steps[1].status.textContent, 'pickup.status.pending');
  check(boxes[0], true);
  state.steps.paid = false; // The store also enforces payment when items already exist.
  check(boxes[0], true);
  assert.equal(state.steps.packed, false);
});
