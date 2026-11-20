import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createMallMenu} from '../demos/corporate/gjh/v11/assets/mall-menu.js';
import {createGraphicsQuality} from '../demos/corporate/gjh/v11/assets/graphics-quality.js';

const markup = readFileSync(new URL('../templates/gallery/gjh-v11-index.html', import.meta.url), 'utf8');

function mockGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {value, configurable: true, writable: true});
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  });
}

class Element extends EventTarget {
  attributes = new Map();
  dataset = {};
  hidden = false;
  scrollTop = 0;
  nodes = new Map();
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) { return this.nodes.get(selector); }
  querySelectorAll(selector) { return this.nodes.get(selector) ?? []; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  append(element) { this.child = element; }
  replaceChildren() {}
  click() { this.dispatchEvent(new Event('click')); }
  focus() { this.ownerDocument.activeElement = this; }
}

function fixture(t, touch = true) {
  const doc = {activeElement: null, importNode: node => node};
  mockGlobal(t, 'document', doc);
  mockGlobal(t, 'DOMParser', class { parseFromString() { return {documentElement: new Element()}; } });
  function element() { return Object.assign(new Element(), {ownerDocument: doc}); }
  const dialog = element();
  dialog.open = false;
  let modalOpens = 0;
  dialog.showModal = () => { modalOpens++; dialog.open = true; };
  dialog.close = () => { dialog.open = false; };
  const pages = [...markup.matchAll(/<section data-menu-page="([^"]+)" data-menu-icon="([^"]+)" hidden>\s*<template><span>([^<]+)<\/span><span>([^<]+)<\/span>/g)]
    .map(([, name, icon, title, subtitle]) => {
      const page = element();
      page.dataset = {menuPage: name, menuIcon: icon};
      page.hidden = true;
      page.nodes.set('template', {content: {children: [title, subtitle].map(textContent => ({textContent}))}});
      return page;
    });
  dialog.nodes.set('[data-menu-page]', pages);
  const ids = ['#menu-heading-icon', '#menu-title', '#menu-heading-text', '#menu-subtitle', '#menu-back', '#menu-close',
    '.mall-tools-content', '#menu-sound-card', '#performance-panel', '#menu-minimap-toggle', '#mini-map'];
  for (const id of ids) dialog.nodes.set(id, element());
  const devices = ['touch', 'keyboard'].map(device => {
    const radio = element(), guide = element();
    radio.dataset.menuDevice = device;
    guide.dataset.menuGuide = device;
    return {radio, guide};
  });
  dialog.nodes.set('[data-menu-device]', devices.map(({radio}) => radio));
  dialog.nodes.set('[data-menu-guide]', devices.map(({guide}) => guide));
  const settings = element(), controls = element(), help = element(), tools = element();
  settings.dataset.menuTo = 'settings';
  controls.dataset.menuTo = 'controls';
  help.dataset.menuTo = 'help';
  dialog.nodes.set('[data-menu-to]', [settings, controls, help]);
  const changes = [];
  const menu = createMallMenu(dialog, {touch, canOpen: () => true, beforeOpen() {},
    onChange: () => changes.push(dialog.open), fallbackFocus: tools});
  menu.addOpener(tools, 'menu');
  return {dialog, menu, changes, tools, settings, controls, help, devices, doc,
    page: () => pages.filter(page => !page.hidden).map(page => page.dataset.menuPage),
    modalOpens: () => modalOpens,
  };
}

test('Menu routes between Help and Settings in one modal, and Back restores the trigger', t => {
  const f = fixture(t);
  f.tools.click();
  assert.deepEqual(f.page(), ['menu']);
  assert.equal(f.dialog.querySelector('#menu-back').hidden, true);
  f.help.click();
  assert.deepEqual(f.page(), ['help']);
  f.dialog.querySelector('#menu-back').click();
  assert.equal(f.doc.activeElement, f.help);
  f.settings.click();
  f.controls.click();
  assert.deepEqual(f.page(), ['controls']);
  f.dialog.querySelector('#menu-back').click();
  assert.deepEqual(f.page(), ['settings']);
  assert.equal(f.doc.activeElement, f.controls);
  assert.equal(f.modalOpens(), 1);
  assert.equal(f.tools.getAttribute('aria-expanded'), 'true');
  f.dialog.querySelector('#menu-close').click();
  assert.equal(f.doc.activeElement, f.tools);
  assert.equal(f.tools.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(f.changes, [true, false]);
});

test('Escape closes the whole menu from a subpage and restores the hamburger', t => {
  const f = fixture(t);
  const hamburger = Object.assign(new Element(), {ownerDocument: f.doc});
  f.menu.addOpener(hamburger, 'settings');
  hamburger.click();
  assert.deepEqual(f.page(), ['settings']);
  f.controls.click();
  const escape = Object.assign(new Event('keydown', {cancelable: true}), {key: 'Escape'});
  f.dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.dialog.open, false);
  assert.equal(f.doc.activeElement, hamburger);
});

for (const touch of [true, false]) {
  test(`Controls defaults to the ${touch ? 'touch' : 'keyboard'} guide and only shows the selected guide`, t => {
    const f = fixture(t, touch);
    f.tools.click();
    f.settings.click();
    f.controls.click();
    const [mobile, desktop] = f.devices;
    assert.equal(mobile.guide.hidden, !touch);
    assert.equal(desktop.guide.hidden, touch);
    const [selected, other] = touch ? [mobile, desktop] : [desktop, mobile];
    assert.equal(selected.radio.getAttribute('aria-checked'), 'true');
    assert.equal(other.radio.tabIndex, -1);
    other.radio.click();
    assert.equal(other.guide.hidden, false);
    assert.equal(selected.guide.hidden, true);
    assert.equal(other.radio.tabIndex, 0);
  });
}

test('Graphics exposes measured resolution and refresh only when available and no independent shadow control', t => {
  const graphics = markup.split('data-menu-page="graphics"')[1].split('</section>')[0];
  assert.match(graphics, /id="menu-resolution" hidden/);
  assert.match(graphics, /id="menu-refresh-rate" hidden/);
  assert.doesNotMatch(graphics, /real-time shadows/i);
  assert.equal([...graphics.matchAll(/<select/g)].length, 1);
  const ids = ['graphics-quality', 'auto-resolution', 'graphics-quality-status', 'menu-resolution', 'menu-refresh-rate'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
  for (const id of ['menu-resolution', 'menu-refresh-rate']) {
    nodes[id].hidden = true;
    nodes[id].nodes.set('output', new Element());
  }
  mockGlobal(t, 'document', {getElementById: id => nodes[id]});
  mockGlobal(t, 'window', {matchMedia: () => ({matches: false}), innerWidth: 1200, innerHeight: 820});
  const quality = createGraphicsQuality(() => {});
  quality.apply(quality.resolve(1200));
  assert.equal(nodes['menu-resolution'].querySelector('output').value, '100%');
  assert.equal(nodes['menu-refresh-rate'].hidden, true);
  for (let i = 0; i <= 120; i++) quality.observeRefresh(i * (1000 / 60), true);
  assert.equal(nodes['menu-refresh-rate'].hidden, false);
  assert.equal(nodes['menu-refresh-rate'].querySelector('output').value, '60 Hz');
});
