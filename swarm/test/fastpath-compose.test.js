'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { compose } = require('../lib/composer');
const { loadAll, clearCache } = require('../lib/recipes');
const { route } = require('../lib/router');
const { validate } = require('../lib/contract');
const { checkProject } = require('../tools/check-sections');

const selection = { recipe: 'corporate-landing', brand: 'gjh' };
const request = 'Build a corporate landing page for Goh Joo Hin';
const expectedIds = ['01-header', '02-hero', '03-brands', '04-about', '05-enquiry', '06-footer'];

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fastpath-compose-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function selected(text) {
  const result = route(text, loadAll());
  assert.ok(result, text);
  assert.deepEqual({ recipe: result.recipe, brand: result.brand }, selection);
  assert.ok(result.confidence >= 0.8 && result.confidence <= 1);
  assert.ok(result.reason);
}

test('routes a supported corporate page and applies its default kit', () => {
  selected(request);
  selected('Build a corporate website');
  selected('Build a corporate website for our company');
});

test('rejects unsupported requests, brand-only requests, and unknown companies', () => {
  for (const text of ['', null, 'GJH', 'Change the colours', 'Build a sales dashboard for GJH',
    'A corporate landing page with a shopping cart', 'Build a corporate site for Acme', 'What is the GJH website?',
    'Build a landing page for xGJHx', 'Build a personal portfolio site', 'x'.repeat(4097)]) {
    assert.equal(route(text, loadAll()), null, String(text).slice(0, 40));
  }
});

test('matches brand aliases on phrase boundaries, including mixed case and punctuation', () => {
  selected('Make a homepage for GOH JOO HIN');
  selected('/fast Make a landing page for Goh-Joo-Hin');
  selected('Build the ＧＪＨ website');
  selected('Make a new website for gjhglobal.com');
  assert.equal(route('Create a website for gjhglobal.company', loadAll()), null);
});

test('router p99 stays under 5 ms across 1000 sampled calls', t => {
  const catalog = loadAll();
  const cases = [request, 'Build a B2B corporate website', 'Homepage for GJH',
    'Corporate website for another brand', 'Make a portfolio website', 'x'.repeat(4096)];
  for (let i = 0; i < 100; i++) route(cases[i % cases.length], catalog);
  const samples = Array.from({ length: 1000 }, (_, index) => {
    const start = performance.now();
    route(cases[index % cases.length], catalog);
    return performance.now() - start;
  }).sort((first, second) => first - second);
  const p99 = samples[Math.ceil(samples.length * 0.99) - 1];
  t.diagnostic(`Router p99: ${p99.toFixed(4)} ms across ${samples.length} samples`);
  assert.ok(p99 < 5, `p99 was ${p99.toFixed(4)} ms`);
});

test('loads validated assets once, reports hits, and supports a cold reload', () => {
  clearCache();
  const catalog = loadAll();
  assert.equal(catalog.hits, 0);
  assert.equal(loadAll(), catalog);
  assert.equal(catalog.hits, 1);
  assert.ok(Object.isFrozen(catalog.brands.gjh.content.brands.cards[0]));
  const cold = loadAll({ cold: true });
  assert.notEqual(cold, catalog);
  assert.equal(cold.hits, 0);
});

test('composes identical bytes into separate projects and emits a valid contract', t => {
  const directory = temporary(t);
  const first = path.join(directory, 'first');
  const second = path.join(directory, 'second');
  const catalog = loadAll();
  const a = compose({ ...selection, outDir: first });
  const b = compose({ recipe: catalog.recipes[selection.recipe], brand: catalog.brands[selection.brand], outDir: second });

  assert.deepEqual(a.files, b.files);
  assert.deepEqual(a.contract, b.contract);
  assert.equal(a.files.length, 13);
  assert.deepEqual(a.contract.sections.map(section => section.id), expectedIds);
  assert.deepEqual(validate(a.contract), { ok: true, errors: [] });
  for (const file of a.files) {
    assert.deepEqual(fs.readFileSync(path.join(first, file)), fs.readFileSync(path.join(second, file)), file);
  }
  const { sections, findings } = checkProject(first);
  assert.equal(sections.length, 6);
  assert.deepEqual(findings, []);
});

test('escapes slot text, alt text, link attributes and repeated content without reinterpreting placeholders', t => {
  const outDir = temporary(t);
  const value = `<script>alert("x")</script> & '{{scope}}'`;
  const escaped = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;{{scope}}&#39;';
  const cards = loadAll().brands.gjh.content.brands.cards;
  const result = compose({ ...selection, outDir, overrides: {
    tokens: { accent: '--sds-color-gold-300' },
    sections: {
      '02-hero': { title: value, imageAlt: value, primaryUrl: 'https://example.test/?item=one&qty=2' },
      '03-brands': { cards: [{ ...cards[0], description: value }] },
    },
  } });
  const hero = fs.readFileSync(path.join(outDir, 'sections/02-hero.html'), 'utf8');
  const brands = fs.readFileSync(path.join(outDir, 'sections/03-brands.html'), 'utf8');
  const css = fs.readFileSync(path.join(outDir, 'sections/02-hero.css'), 'utf8');

  assert.ok(hero.includes(`>${escaped}</h1>`));
  assert.ok(hero.includes(`alt="${escaped}"`));
  assert.ok(hero.includes('href="https://example.test/?item=one&amp;qty=2"'));
  assert.ok(brands.includes(`>${escaped}</p>`));
  assert.doesNotMatch(hero + brands, /<script>/i);
  assert.ok(css.includes('background: var(--sds-color-gold-300)'));
  assert.equal(result.contract.sections[1].slots.title, value);
});

test('validates override URLs, tokens, and IDs before touching the output', t => {
  const root = temporary(t);
  const outDir = path.join(root, 'project');
  const [baseCard] = loadAll().brands.gjh.content.brands.cards;
  const longText = 'x'.repeat(4096);
  const oversizedCards = Array.from({ length: 24 }, () => ({
    ...baseCard, title: longText, description: longText, category: longText,
  }));
  for (const overrides of [
    { sections: { '02-hero': { primaryUrl: 'javascript:alert(1)' } } },
    { sections: { '02-hero': { image: '//example.test/remote.png' } } },
    { sections: { '02-hero': { image: '/gjh/../private.png' } } },
    { sections: { '../outside': { title: 'Unsafe' } } },
    { sections: { '02-hero': { unknown: true } } },
    { tokens: { ink: '--sds-color-white); color: red; (' } },
    { tokens: { ink: '--sds-color-unknown' } },
    { sections: { '03-brands': { cards: oversizedCards } } },
  ]) {
    assert.throws(() => compose({ ...selection, outDir, overrides }), TypeError);
    assert.deepEqual(fs.readdirSync(root), []);
  }
});

test('replaces old sections and layers while preserving project metadata and unrelated files', t => {
  const root = temporary(t);
  const outDir = path.join(root, 'project');
  const sections = path.join(outDir, 'sections');
  fs.mkdirSync(sections, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'agents.json'), '{"keep":true}');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'untouched');
  fs.writeFileSync(path.join(sections, '02-hero.color.css'), '.old {}');
  fs.writeFileSync(path.join(sections, '09-old.html'), '<section></section>');
  fs.writeFileSync(path.join(sections, '09-old.css'), '.old {}');
  fs.writeFileSync(path.join(sections, 'notes.txt'), 'keep');

  const { files } = compose({ ...selection, outDir });
  assert.deepEqual(fs.readdirSync(root).sort(), ['outside.txt', 'project']);
  assert.deepEqual(fs.readdirSync(outDir).sort(), ['agents.json', 'contract.json', 'sections']);
  assert.deepEqual(fs.readdirSync(sections).sort(), [...files.filter(file => file.startsWith('sections/')).map(file => path.basename(file)), 'notes.txt'].sort());
  assert.equal(fs.readFileSync(path.join(root, 'outside.txt'), 'utf8'), 'untouched');
  assert.equal(fs.readFileSync(path.join(outDir, 'agents.json'), 'utf8'), '{"keep":true}');
});

test('does not follow output directory, section file, or contract symlinks', t => {
  const root = temporary(t);
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'sentinel'), 'outside');
  const outDir = path.join(root, 'project');
  fs.symlinkSync(outside, outDir, 'dir');
  assert.throws(() => compose({ ...selection, outDir }), /real output directory/);

  fs.unlinkSync(outDir);
  fs.mkdirSync(outDir);
  const sections = path.join(outDir, 'sections');
  fs.symlinkSync(outside, sections, 'dir');
  assert.throws(() => compose({ ...selection, outDir }), /real output directory/);

  fs.unlinkSync(sections);
  fs.mkdirSync(sections);
  const contract = path.join(outDir, 'contract.json');
  const section = path.join(sections, '01-header.html');
  fs.symlinkSync(path.join(outside, 'sentinel'), contract);
  assert.throws(() => compose({ ...selection, outDir }), /regular output file/);
  fs.unlinkSync(contract);
  fs.symlinkSync(path.join(outside, 'sentinel'), section);
  assert.throws(() => compose({ ...selection, outDir }), /regular output file/);

  assert.deepEqual(fs.readdirSync(sections), ['01-header.html']);
  assert.deepEqual(fs.readdirSync(outside), ['sentinel']);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel'), 'utf8'), 'outside');
});

test('overwrites internal hard links by replacement, leaving outside files intact', t => {
  const root = temporary(t);
  const outside = path.join(root, 'outside');
  const outDir = path.join(root, 'project');
  fs.mkdirSync(outDir);
  fs.writeFileSync(outside, 'outside');
  fs.linkSync(outside, path.join(outDir, 'contract.json'));

  compose({ ...selection, outDir });

  assert.equal(fs.readFileSync(outside, 'utf8'), 'outside');
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'contract.json'), 'utf8')).recipe, selection.recipe);
});
