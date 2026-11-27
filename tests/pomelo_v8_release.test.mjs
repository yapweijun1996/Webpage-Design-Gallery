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
  return {
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

function updateHarness({registration = null, hasWorker = true} = {}) {
  const timers = clock();
  const sw = new Events();
  sw.getRegistration = async () => registration;
  const button = {dataset: {}, classList: {add() {}, remove() {}},
    querySelector: () => ({}), setAttribute() {}, addEventListener() {}};
  const state = {dirty: false, reloads: 0, confirms: [], answer: true};
  const context = {
    ...timers, URL, navigator: hasWorker ? {serviceWorker: sw} : {},
    document: {baseURI: 'https://example.test/v8/', querySelector(selector) {
      if (selector === '[data-update]') return button;
      if (selector === '[data-update-status]') return {};
      return {content: selector.includes('root') ? './' : '8.2.4'};
    }},
    window: {location: {reload() { state.reloads += 1; }}}, location: {protocol: 'file:'},
    t: key => key, toast() {}, hasUnsavedInput: () => state.dirty,
    confirm(options) { state.confirms.push(options); return Promise.resolve(state.answer); },
  };
  const api = vm.runInNewContext(source('assets/js/core/update.js') + '\ninit(); ({apply})', context);
  return {...timers, ...api, state, button, sw};
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
  assert.equal(h.sw.count('controllerchange'), 1);
  h.fire(12000);
  assert.equal(h.button.dataset.state, 'error');
  assert.equal(h.button.disabled, false);
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
  vm.runInNewContext(guard, {...timers, window, navigator, document, MessageChannel,
    location: {reload() { state.reloads += 1; }},
    sessionStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
  });
  return {...timers, window, navigator, sw, state, storage};
}

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
      this.classList = {add() {}, remove() {}};
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    append(...nodes) {
      for (const node of nodes) { this.children.push(node); node.parentElement = this; }
    }
    remove() { this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
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
  document.body = new Element('body');
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
  const {open, confirm} = vm.runInNewContext(source('assets/js/core/dialog.js') + '\n({open, confirm})', {
    document, window: {scrollY: 0, scrollTo() {}}, t: key => key, icon: () => new Element('svg'),
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
  handle.close();
  assert.equal(document.activeElement, opener);
  assert.equal(main.inert, false);
  assert.equal(existingInert.inert, true);
  for (const node of [region, status, alert]) assert.equal(node.inert, false);
  assert.equal(document.count('keydown'), 0);

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
