'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const { createComponentRoutes } = require('../lib/component-routes');
const { createPublication } = require('../lib/publication');
const { AnchorRequestError } = require('../lib/anchor-manager');
const integrator = require('../lib/integrator');
const ownership = require('../lib/ownership');

const SECTION = '01-header';
const HEADER = 'sections/01-header.html';
const CSS = 'sections/01-header.css';
const PEER = 'sections/02-hero.html';
const ASSET = 'assets/generated/01-header-preview.webp';
const ORIGINAL = '<header class="s-01" id="01-header"><h1>Original heading</h1></header>';
const EDITED = '<header class="s-01" id="01-header"><h1>New local heading</h1></header>';
const BEFORE_CSS = '.s-01 { color: black; }';
const AFTER_CSS = '.s-01 { color: #111; }';
const HERO = '<section class="s-02" id="02-hero"><p>Peer content</p></section>';
const TARGET = 'component-fixture';
const LIST = '/api/component-versions';
const RESTORE = '/api/component-rollback';
const HANDLED = { ok: true, perWidth: [] };

function write(root, relative, data, mode = 0o644) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  fs.chmodSync(file, mode);
}

const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');

async function fixture(t, options = {}) {
  const projectDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-component-test-')));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  write(projectDir, HEADER, ORIGINAL);
  write(projectDir, CSS, BEFORE_CSS, 0o640);
  write(projectDir, PEER, HERO);
  const manifest = ownership.build({ launchContext: true, agents: [
    { id: '01', section: 'header' }, { id: '02', section: 'hero' },
  ] });
  const sections = [{ id: SECTION, label: 'Header', owner: '01' }, { id: '02-hero', label: 'Hero', owner: '02' }];
  const production = createPublication(projectDir, async (before, after, flags) =>
    flags.componentRestore ? options.impact?.(before, after, flags) ?? HANDLED : HANDLED);
  const workspace = integrator.open(projectDir, '01', manifest);
  let published;
  try {
    write(workspace.dir, HEADER, EDITED);
    write(workspace.dir, CSS, AFTER_CSS);
    write(workspace.dir, ASSET, 'fixture image');
    published = await production.publish(workspace, {
      anchor: null, workerId: '01', owner: SECTION, cancelled: () => false, checkOutbox() {},
    });
    assert.equal(published.ok, true, JSON.stringify(published.rejected));
  } finally { integrator.close(workspace); }
  fs.chmodSync(path.join(projectDir, CSS), 0o600);

  const events = [];
  const routes = createComponentRoutes({ projectDir, projectId: TARGET, catalog: () => ({ sections, manifest }),
    publish: production.publish, busy: options.busy ?? (() => false), changed: result => events.push(result),
    authorize(req) {
      if (req.headers['x-swarm-anchor-token'] !== 'studio-token') throw new AnchorRequestError(403, 'Open Studio Review.');
    },
  });
  const call = async (url, body, token = 'studio-token') => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    req.method = body === undefined ? 'GET' : 'POST';
    req.headers = { 'content-type': 'application/json', 'x-swarm-anchor-token': token };
    return routes.handle(req, {}, new URL(url, 'http://localhost'),
      (_, status, data) => ({ status, data }));
  };
  const list = () => call(LIST + '?sectionId=' + SECTION);
  const version = (await list()).data.versions[0];
  assert.equal(version.snapshotId, published.snapshotId);
  const request = { projectId: TARGET, sectionId: SECTION, snapshotId: version.snapshotId, expectedRevision: version.expectedRevision };
  return { projectDir, routes, call, list, request, events };
}

test('restores an audited component through staged impact review and records an undo version', async t => {
  let checked = 0;
  let f;
  f = await fixture(t, { impact(before, after, flags) {
    checked += 1;
    const first = checked === 1;
    assert.equal(flags.owner, SECTION);
    assert.equal(flags.componentRestore, true);
    assert.equal(read(f.projectDir, HEADER), first ? EDITED : ORIGINAL);
    assert.equal(read(before, HEADER), first ? EDITED : ORIGINAL);
    assert.equal(read(after, HEADER), first ? ORIGINAL : EDITED);
    assert.equal(read(after, PEER), HERO);
    assert.equal(fs.existsSync(path.join(after, ASSET)), !first);
    return HANDLED;
  } });
  assert.deepEqual((await f.call(LIST + '?sectionId=02-hero')).data.versions, []);
  assert.equal((await f.call(RESTORE, f.request, 'missing')).status, 403);
  const result = await f.call(RESTORE, { ...f.request, paths: [PEER] });
  assert.equal(result.status, 200);
  assert.equal(checked, 1);
  assert.deepEqual(result.data.restored, [ASSET, CSS, HEADER]);
  assert.equal(read(f.projectDir, HEADER), ORIGINAL);
  assert.equal(read(f.projectDir, CSS), BEFORE_CSS);
  assert.equal(read(f.projectDir, PEER), HERO);
  assert.equal(fs.existsSync(path.join(f.projectDir, ASSET)), false);
  assert.equal(fs.statSync(path.join(f.projectDir, CSS)).mode & 0o777, 0o640);
  const history = (await f.list()).data;
  assert.equal(history.busy, false);
  assert.equal(history.versions[0].snapshotId, result.data.undoId);
  const audit = read(f.projectDir, 'integration/log.jsonl').trim().split('\n').map(JSON.parse).at(-1);
  assert.equal(audit.owner, 'studio-operator');
  assert.equal(audit.sectionId, SECTION);
  assert.equal(audit.sourceSnapshotId, result.data.snapshotId);
  assert.equal(f.events.filter(Boolean).length, 1);
  const { snapshotId, expectedRevision } = history.versions[0];
  const undo = await f.call(RESTORE, { ...f.request, snapshotId, expectedRevision });
  assert.equal(undo.status, 200);
  assert.equal(read(f.projectDir, HEADER), EDITED);
  assert.equal(fs.statSync(path.join(f.projectDir, CSS)).mode & 0o777, 0o600);
  assert.equal(read(f.projectDir, ASSET), 'fixture image');
  assert.equal(read(f.projectDir, PEER), HERO);
});

test('rejects a stale confirmation and a changed or unavailable project', async t => {
  let busy = false;
  const f = await fixture(t, { busy: () => busy });
  assert.equal((await f.call(RESTORE, { ...f.request, projectId: 'other-project' })).status, 409);
  busy = true;
  assert.equal((await f.call(RESTORE, f.request)).status, 409);
  busy = false;
  write(f.projectDir, CSS, '.s-01 { color: #555; }');
  assert.equal((await f.call(RESTORE, f.request)).status, 409);
  assert.equal(read(f.projectDir, HEADER), EDITED);
  assert.notEqual((await f.list()).data.versions[0].expectedRevision, f.request.expectedRevision);
});

test('shows busy during review and a stop prevents a staged restore and audit', async t => {
  let reviewStarted;
  let endReview;
  const started = new Promise(resolve => { reviewStarted = resolve; });
  const f = await fixture(t, { impact() {
    return new Promise(resolve => {
      endReview = () => resolve(HANDLED);
      reviewStarted();
    });
  } });
  const pending = f.call(RESTORE, f.request);
  await started;
  try {
    assert.equal((await f.list()).data.busy, true);
    assert.equal((await f.call(RESTORE, f.request)).status, 409);
    f.routes.cancel();
  } finally { endReview(); }
  assert.equal((await pending).status, 409);
  assert.equal(read(f.projectDir, HEADER), EDITED);
  assert.equal(f.events.filter(Boolean).length, 0);
  assert.equal((await f.list()).data.busy, false);
});
