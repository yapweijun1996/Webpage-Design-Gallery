'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { LAYERS, layerFile, parseSectionFile, listLayers, assembleCss } = require('../lib/layers');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-layers-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sections = path.join(root, 'sections');
  fs.mkdirSync(sections);
  return { root, sections, write: (file, css) => fs.writeFileSync(path.join(sections, file), css) };
}

test('validates section names and recognizes only known file kinds and layers', () => {
  assert.deepEqual(LAYERS, ['layout', 'type', 'color', 'imagery', 'icons', 'motion', 'polish']);
  assert.deepEqual(parseSectionFile('02-hero_intro.html'), { base: '02-hero_intro', kind: 'html' });
  assert.deepEqual(parseSectionFile('02-hero.css'), { base: '02-hero', kind: 'base' });
  for (const layer of LAYERS) {
    const file = layerFile('02-hero', layer);
    assert.equal(file, `02-hero.${layer}.css`);
    assert.deepEqual(parseSectionFile(file), { base: '02-hero', kind: 'layer', layer });
  }
  for (const base of ['02-', '2-hero', 'hero', '02-hero.css', '02-..', '../02-hero', '02-foo/bar', '02-foo\\bar', null]) {
    assert.throws(() => layerFile(base, 'layout'), /Invalid section base/);
    assert.throws(() => listLayers('.', base), /Invalid section base/);
    assert.throws(() => assembleCss('.', base), /Invalid section base/);
    assert.equal(parseSectionFile(`${base}.css`), null);
  }
  assert.throws(() => layerFile('02-hero', 'unknown'), /Unknown layer/);
  for (const name of ['02-hero.unknown.css', '02-hero.bundle.css', '02-hero.type.html', '02-hero.CSS', '02-hero.html.bak', '02-hero.css\n', null]) {
    assert.equal(parseSectionFile(name), null);
  }
});

test('assembles base bytes and existing layers in fixed order', t => {
  const { sections, write } = fixture(t);
  const base = ' \n/* original */\r\n.s-02 { color: black }\n';
  write('02-hero.css', base);
  assert.equal(assembleCss(sections, '02-hero'), base);
  write('02-hero.polish.css', '/* polish CSS */');
  write('02-hero.color.css', '');
  write('02-hero.layout.css', '/* layout CSS */');
  write('02-hero.unknown.css', '/* unrelated CSS */');
  write('03-other.layout.css', '/* other CSS */');
  fs.mkdirSync(path.join(sections, '02-hero.type.css'));
  assert.deepEqual(listLayers(sections, '02-hero'), ['layout', 'color', 'polish'].map(layer => ({
    layer, file: path.join(sections, `02-hero.${layer}.css`),
  })));
  const layers = '/* layer: layout */\n/* layout CSS */\n/* layer: color */\n\n/* layer: polish */\n/* polish CSS */';
  assert.equal(assembleCss(sections, '02-hero'), base + '\n' + layers);
  fs.unlinkSync(path.join(sections, '02-hero.css'));
  assert.equal(assembleCss(sections, '02-hero'), layers);
  const missing = path.join(sections, 'missing');
  assert.deepEqual(listLayers(missing, '02-hero'), []);
  assert.equal(assembleCss(missing, '02-hero'), '');
  assert.equal(assembleCss(sections, '04-missing'), '');
});

test('skips dangling and outbound links while allowing targets inside sections', t => {
  const { root, sections, write } = fixture(t);
  const sibling = path.join(root, 'sections-neighbor');
  fs.mkdirSync(sibling);
  const outside = path.join(sibling, 'outside.css');
  fs.writeFileSync(outside, 'outside');
  fs.symlinkSync(outside, path.join(sections, '02-hero.css'));
  fs.symlinkSync(outside, path.join(sections, '02-hero.type.css'));
  fs.symlinkSync('missing.css', path.join(sections, '02-hero.color.css'));
  write('shared.css', 'inside');
  const inside = path.join(sections, '02-hero.layout.css');
  fs.symlinkSync('shared.css', inside);

  assert.deepEqual(listLayers(sections, '02-hero'), [{ layer: 'layout', file: inside }]);
  assert.equal(assembleCss(sections, '02-hero'), '/* layer: layout */\ninside');
});
