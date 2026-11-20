'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const { compileFunction } = require('node:vm');
const { violations } = require('../lib/guard');
const { roster, pickSquad, waves, ownedGlobs, promptFor } = require('../lib/squad');

const BASE = '02-hero';
const SPECIALISTS = roster();
const ids = squad => squad.map(spec => spec.id);
const byId = Object.fromEntries(SPECIALISTS.map(spec => [spec.id, spec]));

test('loads all ten specialists with one owner for each CSS layer', () => {
  assert.deepEqual(ids(SPECIALISTS), [
    'layout', 'type', 'color', 'imagery', 'image-gen', 'icons', 'copy', 'motion', 'qa', 'researcher',
  ]);
  assert.deepEqual(SPECIALISTS.flatMap(spec => spec.layer ? [spec.layer] : []), [
    'layout', 'type', 'color', 'imagery', 'icons', 'motion', 'polish',
  ]);
  for (const spec of SPECIALISTS) {
    assert.ok(spec.title.trim());
    assert.ok(spec.mission.trim());
    assert.ok(Array.isArray(spec.writes));
    const role = { 'image-gen': 'image', researcher: 'research' }[spec.id] ?? 'workers';
    assert.equal(spec.role, role);
    assert.equal(spec.runner, role === 'workers' ? 'pi' : 'codex');
  }
});

test('loads the roster with the local layer order when the layers module is missing', () => {
  const filename = require.resolve('../lib/squad');
  const loadModule = compileFunction(fs.readFileSync(filename, 'utf8'), ['require', '__dirname', 'module']);
  const localRequire = createRequire(filename);
  const requireWithoutLayers = id => localRequire(id);
  requireWithoutLayers.resolve = id => {
    assert.equal(id, './layers');
    throw Object.assign(new Error('Module unavailable'), { code: 'MODULE_NOT_FOUND' });
  };
  const module = { exports: {} };
  loadModule(requireWithoutLayers, path.dirname(filename), module);
  assert.deepEqual(module.exports.roster(), SPECIALISTS);
});

test('rejects duplicate specialist IDs and duplicate layers', t => {
  let entries = [...SPECIALISTS, byId.type];
  const rosterPath = require.resolve('../squad/roster.json');
  const readFile = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (filename, ...args) =>
    filename === rosterPath ? JSON.stringify(entries) : readFile(filename, ...args));

  assert.throws(roster, /duplicate squad specialist ID: type/i);
  entries = [...SPECIALISTS, { ...byId.type, id: 'another-type' }];
  assert.throws(roster, /duplicate squad layer: type/i);
});

test('rejects invalid layers, runners, write paths, and missing required specialists', t => {
  let entries;
  const rosterPath = require.resolve('../squad/roster.json');
  const readFile = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (filename, ...args) =>
    filename === rosterPath ? JSON.stringify(entries) : readFile(filename, ...args));

  const others = SPECIALISTS.filter(spec => spec.id !== 'type');
  entries = [...others, { ...byId.type, layer: 'unknown' }];
  assert.throws(roster, /invalid squad layer/i);
  entries = [...others, { ...byId.type, runner: 'other' }];
  assert.throws(roster, /invalid squad runner/i);
  entries = [...others, { ...byId.type, writes: ['sections/{base}.html'] }];
  assert.throws(roster, /invalid squad writes/i);
  entries = SPECIALISTS.filter(spec => spec.id !== 'layout');
  assert.throws(roster, /requires layout and qa/i);
});

test('always selects layout and QA, including when the request has no keyword match', () => {
  assert.deepEqual(ids(pickSquad(undefined, undefined)), ['layout', 'qa']);
  assert.deepEqual(ids(pickSquad({}, 'Move the top block', SPECIALISTS)), ['layout', 'qa']);
});

test('selects color for a British English colour request', () => {
  assert.deepEqual(ids(pickSquad(null, 'change colours', SPECIALISTS)), ['layout', 'qa', 'color']);
});

test('selects icons for new icons', () => {
  assert.deepEqual(ids(pickSquad(null, 'new icons', SPECIALISTS)), ['layout', 'qa', 'icons']);
});

test('pairs background image replacement with imagery and image generation', () => {
  assert.deepEqual(ids(pickSquad(null, 'replace background image', SPECIALISTS)), [
    'layout', 'qa', 'imagery', 'image-gen',
  ]);
  assert.deepEqual(ids(pickSquad(null, 'add new icons and crop the background image', SPECIALISTS)), [
    'layout', 'qa', 'imagery', 'icons',
  ]);
});

test('caps the squad at eight unique specialists without displacing required roles', () => {
  const request = 'Research brand history and replace the background image, then update icons, colours, fonts, copy and motion.';
  const selected = ids(pickSquad(null, request, SPECIALISTS));
  assert.equal(selected.length, 8);
  assert.equal(new Set(selected).size, 8);
  for (const id of ['layout', 'qa', 'imagery', 'image-gen', 'researcher']) assert.ok(selected.includes(id));
});

test('uses visible element tags and paths to supplement the explicit request', () => {
  const scope = { sections: ['02'], elements: [
    { section: '02', tag: 'img' },
    { section: '02', tag: 'h1' },
    { section: '02', tag: 'path', path: 'a > svg > path' },
  ] };
  assert.deepEqual(ids(pickSquad(scope, { text: 'change colors' }, SPECIALISTS)), [
    'layout', 'qa', 'color', 'imagery', 'icons', 'type',
  ]);
});

test('orders research, parallel work, layout integration, then QA and skips empty waves', () => {
  const squad = ['qa', 'imagery', 'layout', 'researcher', 'image-gen', 'copy', 'type'].map(id => byId[id]);
  assert.deepEqual(waves(squad).map(ids), [
    ['researcher'], ['imagery', 'image-gen', 'copy', 'type'], ['layout'], ['qa'],
  ]);
  assert.deepEqual(waves([byId.layout, byId.qa]).map(ids), [['layout'], ['qa']]);
});

test('the file guard permits only the assigned output paths for each specialist', () => {
  const expected = {
    layout: ['sections/02-hero.html', 'sections/02-hero.layout.css'],
    type: ['sections/02-hero.type.css'],
    color: ['sections/02-hero.color.css'],
    imagery: ['sections/02-hero.imagery.css'],
    'image-gen': ['assets/generated/02-hero-illustration.png'],
    icons: ['sections/02-hero.icons.css'],
    copy: [],
    motion: ['sections/02-hero.motion.css'],
    qa: ['sections/02-hero.polish.css'],
    researcher: ['research.md'],
  };
  const candidates = [
    ...Object.values(expected).flat(),
    'sections/02-hero.css', 'sections/03-news.html', 'sections/02-hero-alternate.type.css',
    ...SPECIALISTS.filter(spec => spec.layer).map(spec => `sections/03-news.${spec.layer}.css`),
    'assets/generated/03-news-illustration.png', 'assets/generated/02-hero-nested/asset.png',
    'assets/generated/02-hero-illustration.jpg', 'assets/02-hero-illustration.png',
  ];
  const changed = new Map(candidates.map(file => [file, { size: 1 }]));
  for (const spec of SPECIALISTS) {
    assert.deepEqual(violations(new Map(), changed, ownedGlobs(spec, BASE)),
      candidates.filter(file => !expected[spec.id].includes(file)).sort(), spec.id);
  }
});

test('ownership rejects forged patterns and section paths with traversal or wildcards', () => {
  assert.deepEqual(ownedGlobs(byId.color, '02-Hero_alt'), ['sections/02-Hero_alt.color.css']);
  for (const base of ['../02-hero', '02-hero/03-news', '02-hero\\03-news', '02-hero..', '02-*']) {
    assert.throws(() => ownedGlobs(byId.color, base), /invalid section base/i);
  }
  assert.throws(() => ownedGlobs({ ...byId.color, writes: ['sections/*.html'] }, BASE), /invalid squad writes/i);
});

test('prompts name the assigned layer file and include the focused section scope', () => {
  const scopeLine = 'The owner selected the hero heading.';
  for (const spec of SPECIALISTS.filter(member => member.layer)) {
    const prompt = promptFor(spec, { base: BASE, scopeLine });
    assert.ok(prompt.includes(spec.title));
    assert.ok(prompt.includes(`sections/02-hero.${spec.layer}.css`));
    assert.ok(prompt.includes('.s-02 or #02-hero'));
    assert.ok(prompt.includes(scopeLine));
    assert.equal(prompt.includes('sections/02-hero.html'), spec.id === 'layout');
  }
  assert.match(promptFor(byId.copy, { base: BASE }), /through chat/);
});
