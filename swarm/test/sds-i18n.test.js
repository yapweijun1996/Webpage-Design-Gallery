'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const system = path.resolve(__dirname, '../design-system');
const browserScript = fs.readFileSync(path.join(system, 'i18n.js'), 'utf8');
const extractor = path.resolve(__dirname, '../tools/i18n-extract.js');

class Element {
  constructor(text = '', attrs = {}) {
    this.nodeType = 1;
    this.text = text;
    this.attrs = new Map(Object.entries(attrs));
    this.children = [];
  }

  get isConnected() { return this.parent?.nodeType === 9 || Boolean(this.parent?.isConnected); }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set textContent(text) { this.text = text; this.children = []; }
  set innerHTML(_text) { assert.fail('Catalog strings must be rendered as text'); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  setAttribute(name, value) { this.attrs.set(name, value); }
  removeAttribute(name) { this.attrs.delete(name); }

  append(...children) {
    for (const child of children) child.parent = this;
    this.children.push(...children);
  }

  matches(selector) {
    return selector.split(',').some(part => this.attrs.has(part.trim().slice(1, -1)));
  }

  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
  }
}

function browser(packs = {}, existingSds) {
  const html = new Element();
  const document = {
    nodeType: 9,
    documentElement: html,
    querySelectorAll: selector => html.querySelectorAll(selector),
  };
  html.parent = document;
  const fetched = [];
  let mutations;
  const window = {
    document,
    async fetch(url) {
      fetched.push(url);
      if (!Object.hasOwn(packs, url)) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ messages: await packs[url] }) };
    },
    MutationObserver: class {
      constructor(callback) { mutations = callback; }
      observe(target, options) {
        assert.equal(target, document);
        assert.equal(options.childList, true);
        assert.equal(options.subtree, true);
      }
    },
  };
  if (existingSds) window.SDS = existingSds;
  vm.runInNewContext(browserScript, { window, document }, { filename: 'i18n.js' });
  return { window, html, fetched, deliver: (...nodes) => mutations([{ addedNodes: nodes }]) };
}

test('standalone browser script substitutes literal text and maps attributes within the supplied root', async () => {
  const { window, html, fetched } = browser({ 'i18n/zh-Hans.json': {
    'hero.title': '<b>你好，{name}！</b>',
    'hero.hint': '你好，{name}',
    'hero.alt': '{name}的图像',
  } });
  const section = new Element('', { 'data-i18n-attr': ' aria-label : hero.hint ; title:hero.hint; ' });
  const title = new Element('Hello!', { 'data-i18n': 'hero.title', 'data-i18n-vars': '{"name":"Mei"}' });
  const image = new Element('', { 'data-i18n-attr': 'alt:hero.alt', 'data-i18n-vars': '{"name":"Mei"}', alt: 'Photo' });
  const outside = new Element('Outside', { 'data-i18n': 'hero.title' });
  section.setAttribute('data-i18n-vars', '{"name":"Mei"}');
  section.append(title, image);
  html.append(section, outside);

  const i18n = window.SDS.i18n;
  await i18n.load('zh-Hans');
  assert.deepEqual(fetched, ['i18n/zh-Hans.json']);
  assert.equal(html.lang, 'zh-Hans');
  assert.equal(title.textContent, 'Hello!');
  i18n.apply(section);
  assert.equal(title.textContent, '<b>你好，Mei！</b>');
  assert.equal(image.getAttribute('alt'), 'Mei的图像');
  assert.equal(section.getAttribute('aria-label'), '你好，Mei');
  assert.equal(section.getAttribute('title'), '你好，Mei');
  assert.equal(outside.textContent, 'Outside');
  assert.equal(i18n.t('hero.hint', { name: '$&' }), '你好，$&');
});

test('English to Chinese to English restores the original text and attributes without fetching en', async () => {
  const sds = { version: '1.0.0' };
  const { window, html, fetched } = browser({ 'i18n/zh-Hans.json': { 'hero.title': '你好', 'hero.label': '欢迎' } }, sds);
  const title = new Element('  Hello!\n', {
    'data-i18n': 'hero.title', 'data-i18n-attr': 'aria-label:hero.label;title:hero.label', title: 'Greeting',
  });
  html.append(title);
  assert.equal(window.SDS, sds);
  const { i18n } = sds;

  await i18n.load('en');
  i18n.apply();
  assert.equal(title.textContent, '  Hello!\n');
  await i18n.load('zh-Hans');
  i18n.apply();
  i18n.apply();
  assert.equal(title.textContent, '你好');
  assert.equal(title.getAttribute('aria-label'), '欢迎');
  await i18n.load('en');
  i18n.apply();
  assert.equal(title.textContent, '  Hello!\n');
  assert.equal(title.getAttribute('title'), 'Greeting');
  assert.equal(title.getAttribute('aria-label'), null);
  assert.equal(html.lang, 'en');
  assert.deepEqual(fetched, ['i18n/zh-Hans.json']);
});

test('English catalog plural selection uses one and other without changing inline en behavior', async () => {
  const { window, html } = browser({ 'i18n/en-SG.json': {
    'cart.items.one': '{n} item', 'cart.items.other': '{n} items',
  } });
  const count = new Element('Items: {n}', { 'data-i18n': 'cart.items', 'data-i18n-vars': '{"n":0}' });
  html.append(count);
  const { i18n } = window.SDS;
  i18n.apply();
  assert.equal(count.textContent, 'Items: 0');
  await i18n.load('en-SG');
  i18n.apply();
  assert.equal(count.textContent, '0 items');
  assert.equal(i18n.t('cart.items', { n: 1 }), '1 item');
  assert.equal(i18n.t('cart.items', { n: 2 }), '2 items');
});

test('Russian plural selection handles one, few, many and other with fallback to other', async () => {
  const { window } = browser({ 'i18n/ru.json': {
    'cart.items.one': '{n} товар', 'cart.items.few': '{n} товара',
    'cart.items.many': '{n} товаров', 'cart.items.other': '{n} товара (дробь)',
    'cart.total.other': 'Всего: {n}',
  } });
  const { i18n } = window.SDS;
  await i18n.load('ru');
  assert.equal(i18n.t('cart.items', { n: 21 }), '21 товар');
  assert.equal(i18n.t('cart.items', { n: 22 }), '22 товара');
  assert.equal(i18n.t('cart.items', { n: 25 }), '25 товаров');
  assert.equal(i18n.t('cart.items', { n: 1.5 }), '1.5 товара (дробь)');
  assert.equal(i18n.t('cart.total', { n: 2 }), 'Всего: 2');
});

test('missing and empty translations fall back to inline content and track unique keys', async () => {
  const { window, html } = browser({ 'i18n/zh-Hans.json': { 'hero.body': '中文', 'hero.alt': '' }, 'i18n/ms.json': {} });
  const body = new Element('English {n}', { 'data-i18n': 'hero.body', 'data-i18n-vars': '{invalid}' });
  const image = new Element('', { 'data-i18n-attr': 'alt:hero.alt', alt: 'Photo' });
  html.append(body, image);
  const { i18n } = window.SDS;
  await i18n.load('zh-Hans');
  i18n.apply();
  assert.equal(body.textContent, '中文');
  assert.equal(image.getAttribute('alt'), 'Photo');
  assert.equal(i18n.t('hero.alt'), 'hero.alt');
  assert.equal(i18n.t('constructor'), 'constructor');
  assert.deepEqual([...i18n.missing], ['hero.alt', 'constructor']);

  await i18n.load('ms');
  i18n.apply();
  assert.equal(body.textContent, 'English {n}');
  assert.deepEqual([...i18n.missing], ['hero.body', 'hero.alt']);
  await i18n.load('en');
  i18n.apply();
  assert.equal(i18n.missing.size, 0);
});

test('number, date and currency formatting uses the specified locale and options', async () => {
  const { window } = browser({ 'i18n/zh-Hans.json': {}, 'i18n/ms.json': {} });
  const { i18n } = window.SDS;
  const date = new Date('2026-11-21T00:00:00Z');
  const dateOpts = { timeZone: 'UTC', dateStyle: 'long' };
  const numOpts = { style: 'percent', minimumFractionDigits: 2 };
  for (const [lang, locale] of [['en', 'en-SG'], ['zh-Hans', 'zh-Hans-SG'], ['ms', 'ms-MY']]) {
    await i18n.load(lang);
    assert.equal(i18n.format.number(1.234, numOpts), Intl.NumberFormat(locale, numOpts).format(1.234));
    assert.equal(i18n.format.date(date, dateOpts), Intl.DateTimeFormat(locale, dateOpts).format(date));
    assert.equal(i18n.format.currency(17), Intl.NumberFormat(locale, { style: 'currency', currency: 'SGD' }).format(17));
    assert.equal(i18n.format.currency(17, 'MYR'), Intl.NumberFormat(locale, { style: 'currency', currency: 'MYR' }).format(17));
  }
});

test('the observer translates late-added elements and descendants', async () => {
  const { window, html, deliver } = browser({ 'i18n/ms.json': { 'form.submit': 'Hantar', 'form.help': 'Bantuan' } });
  await window.SDS.i18n.load('ms');
  const form = new Element('', { 'data-i18n-attr': 'title:form.help', title: 'Help' });
  const button = new Element('Submit', { 'data-i18n': 'form.submit' });
  const detached = new Element('Detached', { 'data-i18n': 'form.submit' });
  form.append(button);
  html.append(form);
  deliver({ nodeType: 3 }, form, detached);
  assert.equal(button.textContent, 'Hantar');
  assert.equal(form.getAttribute('title'), 'Bantuan');
  assert.equal(detached.textContent, 'Detached');
});

test('failed loads leave the active catalog intact and diagnose the failure', async () => {
  const { window, html, fetched } = browser({ 'i18n/ms.json': { 'hero.title': 'Hai' }, 'i18n/zh-Hans.json': ['invalid'] });
  const { i18n } = window.SDS;
  await i18n.load('ms');
  await assert.rejects(i18n.load('zh-Hans'), /i18n\/zh-Hans\.json: expected a messages object/);
  await assert.rejects(i18n.load('ru'), /i18n\/ru\.json: HTTP 404/);
  await assert.rejects(i18n.load('../en'), { name: 'RangeError' });
  assert.equal(html.lang, 'ms');
  assert.equal(i18n.t('hero.title'), 'Hai');
  assert.equal(fetched.length, 3);
});

test('a late response cannot override a more recent language selection', async () => {
  let respond;
  const pending = new Promise(resolve => { respond = resolve; });
  const { window, html } = browser({ 'i18n/zh-Hans.json': pending });
  const { i18n } = window.SDS;
  const earlier = i18n.load('zh-Hans');
  await i18n.load('en');
  respond({ 'hero.title': '你好' });
  await earlier;
  assert.equal(html.lang, 'en');
  assert.equal(i18n.t('hero.title'), 'hero.title');
});

function projectFixture(t, source) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-i18n-test-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'sections'));
  const fragment = (name, text) => fs.writeFileSync(path.join(project, 'sections', name), text);
  fragment('01-hero.html', source);
  const catalogDir = path.join(project, 'i18n');
  const run = (...options) => {
    const result = spawnSync(process.execPath, [extractor, project, ...options], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  };
  return { project, fragment, catalogDir, run };
}

function readCatalog(dir, lang) {
  return JSON.parse(fs.readFileSync(path.join(dir, `${lang}.json`), 'utf8'));
}

const titleFragment = '<h1 data-i18n="hero.title">Hello</h1>';

test('extractor writes English from inline text and attributes and creates empty stubs', t => {
  const { catalogDir, fragment, run } = projectFixture(t, `
    <!-- <p data-i18n="fake.comment">Comment</p> -->
    <h1 data-i18n='hero.title' title="A > B" aria-label='Hello &amp; welcome'
        data-i18n-attr="title:hero.title-hint; aria-label:hero.label;">Hello <em>{name}</em> &#x1F44B;</h1>
    <img alt='Company logo' data-i18n-attr='alt:hero.logo'>
    <script>const markup = '<p data-i18n="fake.script">Script</p>';</script>`);
  fragment('02-copy.html', '<p data-i18n="hero.title">Hello {name} 👋</p>');
  fragment('ignored.css', '<p data-i18n="fake.css">Not an HTML fragment</p>');
  const result = run('--write', '--check');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const en = readCatalog(catalogDir, 'en');
  assert.equal(en.meta.lang, 'en');
  assert.equal(en.meta.status, 'source');
  assert.equal(new Date(en.meta.generated).toISOString(), en.meta.generated);
  assert.deepEqual(en.messages, {
    'hero.label': 'Hello & welcome', 'hero.logo': 'Company logo',
    'hero.title': 'Hello {name} 👋', 'hero.title-hint': 'A > B',
  });
  for (const lang of ['ms', 'zh-Hans']) {
    const stub = readCatalog(catalogDir, lang);
    assert.equal(stub.meta.lang, lang);
    assert.equal(stub.meta.status, 'machine-draft');
    assert.deepEqual(Object.keys(stub.messages), Object.keys(en.messages));
    assert.deepEqual(Object.values(stub.messages), ['', '', '', '']);
  }
});

test('extractor check fails for stale English and leaves the catalog unchanged', t => {
  const { catalogDir, fragment, run } = projectFixture(t, titleFragment);
  assert.equal(run('--write').status, 0);
  const old = readCatalog(catalogDir, 'en');
  fragment('01-hero.html', titleFragment.replace('Hello', 'Welcome'));
  const stale = run('--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /en\.json is stale/);
  assert.deepEqual(readCatalog(catalogDir, 'en'), old);
  assert.equal(run('--write', '--check').status, 0);
  assert.equal(readCatalog(catalogDir, 'en').messages['hero.title'], 'Welcome');
});

test('extractor reports a missing key without overwriting an existing translation', t => {
  const { catalogDir, fragment, run } = projectFixture(t, titleFragment);
  assert.equal(run('--write').status, 0);
  const file = path.join(catalogDir, 'zh-Hans.json');
  const catalog = readCatalog(catalogDir, 'zh-Hans');
  catalog.messages['hero.title'] = '你好';
  const translated = JSON.stringify(catalog);
  fs.writeFileSync(file, translated);
  fragment('01-hero.html', `${titleFragment}<p data-i18n="hero.subtitle">Good morning</p>`);
  assert.equal(run('--write').status, 0);
  const result = run('--check');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /zh-Hans\.json missing keys: hero\.subtitle/);
  assert.match(result.stderr, /ms\.json missing keys: hero\.subtitle/);
  assert.doesNotMatch(result.stderr, /en\.json is stale/);
  assert.equal(fs.readFileSync(file, 'utf8'), translated);
});

test('extractor rejects conflicting duplicates with both source locations', t => {
  const { catalogDir, fragment, run } = projectFixture(t, titleFragment);
  fragment('02-copy.html', '\n<img data-i18n-attr="alt:hero.title" alt="Goodbye">');
  const result = run('--write', '--check');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /02-copy\.html:2.*Duplicate key hero\.title.*different text.*01-hero\.html:1/);
  assert.equal(fs.existsSync(catalogDir), false);
});

test('extractor warns for unmarked visible text and ignores hidden markup', t => {
  const { run } = projectFixture(t, `
    <section><h1 data-i18n="hero.title">Hello <strong>everyone</strong></h1>
    <span>No translation</span>
    <button title="Hint" data-i18n-attr="title:hero.hint">Still visible</button>
    <span hidden>Hidden text</span><div style="display: none !important">Hidden by CSS</div>
    <style>p::before { content: 'Style text'; }</style>
    <template><span>Template text</span></template><!-- Comment text --></section>`);
  const result = run('--write', '--check');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.match(/\[no-i18n-text\]/g)?.length, 2);
  assert.match(result.stderr, /Warning: sections\/01-hero\.html:3.*No translation/);
  assert.match(result.stderr, /Warning: sections\/01-hero\.html:4.*Still visible/);
});

test('extractor uses the catalog override for reads and writes', t => {
  const { project, catalogDir, run } = projectFixture(t, titleFragment);
  const override = path.join(project, 'custom catalogs');
  assert.equal(run('--catalogs', override, '--write', '--check').status, 0);
  assert.equal(readCatalog(override, 'en').messages['hero.title'], 'Hello');
  assert.equal(fs.existsSync(catalogDir), false);
  assert.equal(run('--catalogs', override, '--check').status, 0);
  assert.equal(run('--check').status, 1);
});

test('shell catalogs contain matching SDS-only keys and identify both machine drafts', () => {
  const dir = path.join(system, 'i18n');
  const en = readCatalog(dir, 'en');
  const keys = Object.keys(en.messages).sort();
  assert.equal(en.meta.status, 'source');
  for (const label of ['Theme', 'Brand', 'Language', 'Light', 'Dark', 'Auto', 'Check updates',
    'Update available', 'Update now', 'Version', 'You are offline', 'Skip to content']) {
    assert.ok(Object.values(en.messages).includes(label), `Missing seed label ${label}`);
  }
  for (const lang of ['zh-Hans', 'ms']) {
    const catalog = readCatalog(dir, lang);
    assert.equal(catalog.meta.lang, lang);
    assert.equal(catalog.meta.status, 'machine-draft');
    assert.deepEqual(Object.keys(catalog.messages).sort(), keys);
    assert.ok(Object.values(catalog.messages).every(Boolean));
  }
  assert.equal(keys.length, 15);
  assert.ok(keys.every(key => key.startsWith('sds.')));
});
