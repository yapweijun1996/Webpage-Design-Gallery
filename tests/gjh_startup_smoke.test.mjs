import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('../demos/corporate/gjh/v11/', import.meta.url);

async function runStartup() {
  const noop = () => {};
  const gl = {isContextLost: () => false, fenceSync: () => null, getExtension: () => null};
  class Element extends EventTarget {
    dataset = {};
    style = {setProperty: noop};
    classList = {add: noop, remove: noop, toggle: noop, contains: () => false};
    hidden = true;
    value = '';
    lastChild = {textContent: ''};
    children = [];
    get childNodes() { return this.children; }
    nodes = new Map();
    querySelector(selector) {
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
      return this.nodes.get(selector);
    }
    querySelectorAll() { return []; }
    append(...children) { this.children.push(...children); }
    add(child) { this.append(child); }
    prepend(...children) { this.children.unshift(...children); }
    replaceChildren(...children) { this.children = children; }
    replaceWith() {}
    remove() {}
    cloneNode() { return new Element(); }
    after() {}
    before() {}
    insertBefore(child) { this.append(child); }
    attributes = new Map();
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    toggleAttribute(name, force) {
      if (force) this.setAttribute(name, '');
      else this.removeAttribute(name);
    }
    hasAttribute(name) { return this.attributes.has(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    getAttributeNames() { return [...this.attributes.keys()]; }
    contains() { return true; }
    focus() {}
    getContext() { return gl; }
  }
  const document = new Element();
  const steps = ['physics', 'scene', 'models', 'frame', 'warm'].map(stage => {
    const step = new Element();
    step.dataset.stage = stage;
    return step;
  });
  document.querySelectorAll = selector => {
    if (selector === '.app-loader-steps li') return steps;
    if (selector === '.hud-objective-dots i') return Array.from({length: 4}, () => new Element());
    if (selector === '[data-teleport]') return ['newmoon', 'mili', 'gogo'].map(teleport => {
      const button = new Element();
      button.dataset.teleport = teleport;
      return button;
    });
    return [];
  };
  document.querySelector('.list-summary').querySelectorAll = () => [new Element(), new Element()];
  document.getElementById = id => id === 'walk-preloads' ? null : document.querySelector('#' + id);
  document.createElement = () => new Element();
  document.createElementNS = document.createElement;
  document.importNode = node => node;
  document.body = new Element();
  document.head = new Element();
  document.documentElement = new Element();
  document.documentElement.lang = 'en';
  document.activeElement = document.body;
  document.hidden = false;

  const frames = new Map();
  const requests = [];
  let downloadedBytes = 0;
  let frameId = 0;
  const window = new EventTarget();
  Object.assign(globalThis, {
    document, window, innerWidth: 800, innerHeight: 600,
    HTMLElement: Element,
    location: new URL('https://mall.test/'),
    matchMedia: () => Object.assign(new EventTarget(), {matches: false}),
    DOMParser: class { parseFromString() { return {documentElement: new Element()}; } },
    Option: class { constructor(text, value) { this.text = text; this.value = value; } },
    MutationObserver: class { observe() {} },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    async fetch(url) {
      requests.push(new URL(url).pathname.split('/').at(-1));
      const bytes = await readFile(url);
      downloadedBytes += bytes.length;
      return new Response(bytes);
    },
  });
  Object.assign(window, {innerWidth, innerHeight, devicePixelRatio: 1, matchMedia});
  if (!globalThis.navigator) globalThis.navigator = {userAgent: '', platform: ''};
  // The test has no HTML preload template. The loader itself drives the
  // walk route, both streamed downloads and the real generated bundle import.
  await import(new URL('assets/loader.js', root));
  assert.deepEqual(requests, []);
  assert.equal(window.__mall, undefined);
  location.hash = '#experience';
  window.dispatchEvent(new Event('hashchange'));
  assert.match(document.getElementById('loader-count').textContent, /^0\.0 of \d+\.\d MB$/);
  for (let turn = 0; turn < 1000 && !window.mallLoader.ready; turn++) {
    const state = window.mallLoader.snapshot();
    assert.equal(state.failed, false);
    if (state.stage === 'warm') document.getElementById('loader-enter-now').dispatchEvent(new Event('click'));
    const pending = [...frames.keys()];
    for (const id of pending) {
      const callback = frames.get(id);
      frames.delete(id);
      callback?.(performance.now());
    }
    await delay(5);
  }
  const state = window.mallLoader.snapshot();
  assert.equal(state.ready, true, state.message);
  assert.equal(window.__sceneReady, true);
  assert.equal(window.__mall?.ready, true);
  assert.equal(state.message, 'The mall is ready.');
  assert.deepEqual(state.downloads, [downloadedBytes, downloadedBytes]);
  assert.equal(document.getElementById('loader-count').textContent, '5 / 5');
  assert.deepEqual(steps.map(step => step.dataset.state), Array(5).fill('done'));
  assert.deepEqual(requests.sort(), ['rapier_bg.wasm', 'startup-assets.pack']);
  window.dispatchEvent(new Event('pagehide'));
}

if (process.argv.includes('--startup-fixture')) {
  await runStartup();
} else {
  test('the walk loader streams assets and runs the generated bundle to ready in Node', () => {
    const env = {...process.env};
    delete env.NODE_TEST_CONTEXT;
    const fixture = new URL('fixtures/gjh_startup_modules.mjs', import.meta.url);
    const result = spawnSync(process.execPath, [
      '--experimental-loader', fileURLToPath(fixture), fileURLToPath(import.meta.url), '--startup-fixture'
    ], {env, encoding: 'utf8', timeout: 10_000});
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  });
}
