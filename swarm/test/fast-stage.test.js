'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const { approve, create, lock } = require('../lib/anchors');
const { createFlow } = require('../lib/anchorflow');
const { compose } = require('../lib/composer');
const { createFastPath } = require('../lib/fast-routes');
const { FastStageConflictError, stageFast } = require('../lib/fast-stage');
const { approvedAnchor } = require('../lib/publication');
const versions = require('../lib/versions');

const SELECTION = { recipe: 'corporate-landing', brand: 'gjh' };
const HERO = 'sections/02-hero.html';
const IMAGE = 'assets/generated/02-hero-preview.png';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAABaAAAAACCAAAAACLJyRWAAAAGklEQVR4nO3BgQAAAADDoPlTX+EAVQEAAL8BC0IAARLjJg4AAAAASUVORK5CYII=',
  'base64',
);

function write(root, relative, contents) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function fixture(t) {
  const projectDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-fast-stage-test-')));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const run = path.join(projectDir, '.run');
  fs.mkdirSync(run);
  const makeStage = () => fs.mkdtempSync(path.join(run, 'stage-'));
  write(projectDir, HERO, 'Original hero');
  write(projectDir, 'contract.json', '{"old":true}\n');
  write(projectDir, 'dist/index.html', 'Original export');
  write(projectDir, 'tokens.css', ':root { --project-accent: #123456; }\n');
  write(projectDir, 'channel.jsonl', 'Existing channel');
  return { projectDir, makeStage, run };
}

function makeLocked(f, update = () => {}) {
  const seed = f.makeStage();
  const { contract } = compose({ ...SELECTION, outDir: seed });
  const { projectDir } = f;
  update(contract);
  const { id, dir } = create(projectDir, { files: { desktop: PNG } });
  const flow = createFlow(projectDir);
  for (const [event, actor, data] of [
    ['set_goals', 'manager', { goals: ['A corporate landing page'] }],
    ['anchor_ready', 'system', { anchorId: id }],
    ['advisor_pass', 'advisor'],
    ['approve', 'manager', { anchorId: id }],
  ]) {
    const result = flow.dispatch(event, { actor, ...data });
    assert.equal(result.ok, true, result.error);
  }
  approve(projectDir, id, { by: 'manager' });
  lock(projectDir, id, { ...contract, rules: { desktop: { columns: 12, imagery: 'Corporate hero' } } });
  const result = flow.dispatch('lock', { actor: 'manager', anchorId: id });
  assert.equal(result.ok, true, result.error);
  return { anchor: approvedAnchor(projectDir), contractFile: path.join(dir, 'contract.json') };
}

function assertLive(project) {
  assert.equal(read(project, HERO), 'Original hero');
  assert.equal(read(project, 'contract.json'), '{"old":true}\n');
  assert.equal(read(project, 'dist/index.html'), 'Original export');
  assert.equal(read(project, 'tokens.css'), ':root { --project-accent: #123456; }\n');
  assert.equal(read(project, 'channel.jsonl'), 'Existing channel');
}

async function submitFast(projectDir, callbacks) {
  const input = { projectId: 'swarm-locked-test', text: 'Build a corporate landing page for GJH' };
  const route = createFastPath({
    projectDir, projectId: input.projectId, stageFast, install: versions.install,
    busy: () => false,
    published: event => {
      callbacks.push({ candidate: event.candidate.contract, preview: read(projectDir, 'dist/index.html') });
      return { qualityQueued: true };
    },
    fallback: () => { callbacks.push('fallback'); },
  });
  const req = Object.assign(Readable.from([JSON.stringify(input)]), {
    method: 'POST', headers: { 'content-type': 'application/json' },
  });
  return route.handle(req, {}, '/api/fast', (_, status, data) => ({ status, data }));
}

test('stages the real no-PWA preview, exported images and unrelated section support without editing live inputs', async t => {
  const f = fixture(t);
  write(f.projectDir, 'sections/02-hero.imagery.css', '.old-art {}');
  write(f.projectDir, 'sections/09-old.html', '<h1>Stale section</h1>');
  write(f.projectDir, 'sections/readme.md', 'Section notes');
  write(f.projectDir, 'sections/support/nested.txt', 'Nested support');
  write(f.projectDir, 'notes/private.md', 'Private note');
  const stage = f.makeStage();
  const result = await stageFast({ projectDir: f.projectDir, stage, selection: SELECTION });

  assert.equal(result.contract.sections.length, 6);
  assert.deepEqual(JSON.parse(read(stage, 'contract.json')), result.contract);
  assert.ok(result.files.includes('dist/index.html'));
  assert.ok(result.files.includes('dist/assets/gjh-logo.png'));
  assert.ok(result.files.includes('sections/readme.md'));
  assert.ok(result.files.includes('sections/support/nested.txt'));
  for (const file of result.files) assert.equal(fs.lstatSync(path.join(stage, file)).isFile(), true, file);
  assert.equal(read(stage, 'sections/readme.md'), 'Section notes');
  assert.equal(read(stage, 'sections/support/nested.txt'), 'Nested support');
  for (const file of ['sections/02-hero.imagery.css', 'sections/09-old.html', 'notes', 'channel.jsonl', 'dist/sw.js']) {
    assert.equal(fs.existsSync(path.join(stage, file)), false, file);
  }
  const html = read(stage, 'dist/index.html');
  assert.match(html, /--project-accent: #123456/);
  assert.match(html, /--sds-color-gold-200:/);
  assert.match(html, /\.sds-container/);
  assert.match(html, /src="assets\/gjh-logo\.png"/);
  const { total, compose: composeMs, build } = result.timings;
  assert.ok(total >= composeMs + build && composeMs > 0 && build > 0);
  assertLive(f.projectDir);
  assert.equal(read(f.projectDir, 'sections/02-hero.imagery.css'), '.old-art {}');
});

test('reuses exact locked bytes and materializes every assigned token and slot, including a project-generated image', async t => {
  const f = fixture(t);
  write(f.projectDir, IMAGE, PNG);
  const { anchor, contractFile } = makeLocked(f, contract => {
    contract.version = 12;
    contract.owners['/sections/1/slots/title'] = '02';
    contract.tokens.accent = '--sds-color-blue-700';
    Object.assign(contract.sections.find(section => section.id === '02-hero').slots, {
      title: 'Locked title & exact copy', image: '/' + IMAGE, imageWidth: 1440, imageHeight: 2,
    });
  });
  const stage = f.makeStage();
  const result = await stageFast({ projectDir: f.projectDir, stage, selection: SELECTION, anchor });
  assert.deepEqual(fs.readFileSync(path.join(stage, 'contract.json')), fs.readFileSync(contractFile));
  assert.deepEqual(result.contract, JSON.parse(fs.readFileSync(contractFile, 'utf8')));
  assert.match(read(stage, HERO), /Locked title &amp; exact copy/);
  assert.match(read(stage, 'sections/02-hero.css'), /var\(--sds-color-blue-700\)/);
  assert.match(read(stage, 'dist/index.html'), /src="assets\/02-hero-preview\.png"/);
  assert.deepEqual(fs.readFileSync(path.join(stage, 'dist/assets/02-hero-preview.png')), PNG);
  assert.ok(result.files.includes('dist/assets/02-hero-preview.png'));
  assertLive(f.projectDir);
  assert.deepEqual(fs.readFileSync(path.join(f.projectDir, IMAGE)), PNG);
});

for (const [name, change, message] of [
  ['recipe mismatch', contract => { contract.recipe = 'unknown-landing'; }, /recipe or brand differs/],
  ['brand mismatch', contract => { contract.brand = 'unknown-brand'; }, /recipe or brand differs/],
  ['changed section order', contract => { [contract.sections[0], contract.sections[1]] = [contract.sections[1], contract.sections[0]]; }, /section order or blocks differ/],
  ['incompatible section block', contract => { contract.sections[1].block = 'footer'; }, /section order or blocks differ/],
  ['missing slot', contract => { delete contract.sections[1].slots.title; }, /locked slots or tokens/],
  ['missing token', contract => { delete contract.tokens.accent; }, /locked slots or tokens/],
  ['unknown token value', contract => { contract.tokens.accent = '--sds-color-missing'; }, /locked slots or tokens/],
]) {
  test(`rejects locked contract ${name} before building output`, async t => {
    const f = fixture(t);
    const { anchor } = makeLocked(f, change);
    const stage = f.makeStage();
    await assert.rejects(stageFast({ projectDir: f.projectDir, stage, selection: SELECTION, anchor }), error =>
      error instanceof FastStageConflictError && error.status === 409 && message.test(error.message));
    assert.deepEqual(fs.readdirSync(stage), []);
    assertLive(f.projectDir);
  });
}

test('rejects a stale frozen anchor hash without substituting reserialized contract bytes', async t => {
  const f = fixture(t);
  const { anchor, contractFile } = makeLocked(f);
  fs.chmodSync(contractFile, 0o644);
  fs.appendFileSync(contractFile, '\n');
  fs.chmodSync(contractFile, 0o444);
  const stage = f.makeStage();
  await assert.rejects(stageFast({ projectDir: f.projectDir, stage, selection: SELECTION, anchor }), {
    status: 409, message: /locked design contract changed/,
  });
  assert.deepEqual(fs.readdirSync(stage), []);
  assertLive(f.projectDir);
});

test('a locked required image must resolve from a regular approved render source', async t => {
  const f = fixture(t);
  const { anchor } = makeLocked(f, contract => { contract.sections[1].slots.image = '/' + IMAGE; });
  const linkedSource = path.join(f.projectDir, 'unrelated.png');
  fs.writeFileSync(linkedSource, PNG);
  fs.mkdirSync(path.join(f.projectDir, 'assets/generated'), { recursive: true });
  fs.symlinkSync(linkedSource, path.join(f.projectDir, IMAGE));
  const stage = f.makeStage();
  await assert.rejects(stageFast({ projectDir: f.projectDir, stage, selection: SELECTION, anchor }), {
    status: 409, message: /images that are unavailable/,
  });
  assert.equal(fs.existsSync(path.join(stage, 'dist/assets/02-hero-preview.png')), false);
  assertLive(f.projectDir);
});

test('cancellation stops an in-flight exporter before staging ownership is returned', async t => {
  const f = fixture(t);
  const controller = new AbortController();
  const stage = f.makeStage();
  const pending = stageFast({ projectDir: f.projectDir, stage, selection: SELECTION, signal: controller.signal });
  assert.ok(fs.existsSync(path.join(stage, 'contract.json')));
  const reason = new Error('Superseded Fast Path request.');
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assertLive(f.projectDir);

  const unused = f.makeStage();
  await assert.rejects(stageFast({ projectDir: f.projectDir, stage: unused, selection: SELECTION, signal: controller.signal }),
    error => error === reason);
  assert.deepEqual(fs.readdirSync(unused), []);
});

test('staging refuses to use an existing project directory or a link pointing outside the stage', async t => {
  const f = fixture(t);
  const linked = path.join(f.run, 'linked');
  fs.symlinkSync(path.join(f.projectDir, 'dist'), linked);
  for (const stage of [f.projectDir, linked]) {
    await assert.rejects(stageFast({ projectDir: f.projectDir, stage, selection: SELECTION }), /Fast Path.*stag/);
  }
  assertLive(f.projectDir);
});

test('the Fast Path route installs the exact locked design and notifies quality work after publication', async t => {
  const f = fixture(t);
  write(f.projectDir, IMAGE, PNG);
  const { contractFile } = makeLocked(f, contract => {
    contract.sections[1].slots.title = 'Approved live hero';
    contract.sections[1].slots.image = '/' + IMAGE;
    contract.tokens.accent = '--sds-color-blue-700';
  });
  const callbacks = [];
  const { status, data } = await submitFast(f.projectDir, callbacks);
  const lockedBytes = fs.readFileSync(contractFile);

  assert.equal(status, 200, JSON.stringify(data));
  assert.equal(data.accepted, true);
  assert.equal(data.qualityQueued, true);
  assert.deepEqual(fs.readFileSync(path.join(f.projectDir, 'contract.json')), lockedBytes);
  assert.match(read(f.projectDir, HERO), />Approved live hero<\/h1>/);
  assert.match(read(f.projectDir, 'sections/02-hero.css'), /var\(--sds-color-blue-700\)/);
  const preview = read(f.projectDir, 'dist/index.html');
  assert.match(preview, />Approved live hero<\/h1>/);
  assert.match(preview, /src="assets\/02-hero-preview\.png"/);
  assert.deepEqual(fs.readFileSync(path.join(f.projectDir, 'dist/assets/02-hero-preview.png')), PNG);
  assert.deepEqual(callbacks, [{ candidate: JSON.parse(lockedBytes), preview }]);
  assert.deepEqual(versions.list(f.projectDir).map(({ id, label }) => [id, label]), [[data.snapshotId, 'Before Fast Path']]);
  assert.equal(read(f.projectDir, 'channel.jsonl'), 'Existing channel');
});

test('the Fast Path route preserves an existing checkpoint, export and live sections for an incompatible lock', async t => {
  const f = fixture(t);
  versions.snapshot(f.projectDir, 'Existing checkpoint');
  const prior = versions.list(f.projectDir);
  const { contractFile } = makeLocked(f, contract => { contract.sections[1].block = 'footer'; });
  const lockedBytes = fs.readFileSync(contractFile);
  const callbacks = [];
  const { status, data } = await submitFast(f.projectDir, callbacks);

  assert.equal(status, 409);
  assert.match(data.error, /locked section order or blocks differ/);
  assert.deepEqual(versions.list(f.projectDir), prior);
  assert.deepEqual(fs.readFileSync(contractFile), lockedBytes);
  assert.deepEqual(fs.readdirSync(path.join(f.projectDir, 'sections')), ['02-hero.html']);
  assert.deepEqual(fs.readdirSync(path.join(f.projectDir, 'dist')), ['index.html']);
  assert.deepEqual(callbacks, []);
  assertLive(f.projectDir);
});
