'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const { createFastPath } = require('../lib/fast-routes');
const versions = require('../lib/versions');

const TARGET = { projectId: 'test-project', text: 'Build a corporate homepage for GJH', from: 'owner' };
const FRAGMENT = 'sections/02-hero.html';
const CANDIDATE = { contract: { sections: [{ id: '02-hero' }] }, timings: { compose: 1, build: 2 } };

function write(directory, name, data) {
  const file = path.join(directory, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function stageCandidate(stage, text = 'candidate') {
  write(stage, FRAGMENT, text);
  write(stage, 'contract.json', JSON.stringify(CANDIDATE.contract));
  write(stage, 'dist/index.html', text);
  return CANDIDATE;
}

function fixture(t, options = {}) {
  const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fast-route-')));
  t.after(() => fs.rmSync(project, { force: true, recursive: true }));
  write(project, FRAGMENT, 'before');
  write(project, 'dist/index.html', 'before');
  const calls = [];
  const fast = createFastPath({ projectDir: project, projectId: TARGET.projectId, busy: () => false,
    stageFast({ stage }) { return stageCandidate(stage); }, install: versions.install,
    fallback(input) { calls.push(['fallback', input]); return { id: 7 }; },
    published({ result, text }) { calls.push(['published', text, result.snapshotId]); return { id: 8 }; },
    ...options,
  });
  return {
    project, fast, calls,
    live: () => [FRAGMENT, 'dist/index.html'].map(name => fs.readFileSync(path.join(project, name), 'utf8')),
    async request(route, { method = 'GET', body, contentType = 'application/json' } = {}) {
      const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
      Object.assign(req, { method, headers: { 'content-type': contentType } });
      return fast.handle(req, {}, route, (_, status, data) => ({ status, data }));
    },
  };
}

test('a supported request installs the page, creates a checkpoint, records metrics and notifies background quality', async t => {
  const f = fixture(t);
  const { status, data } = await f.request('/api/fast', { method: 'POST', body: TARGET });
  assert.equal(status, 200);
  assert.equal(data.accepted, true);
  assert.equal(data.id, 8);
  assert.equal(data.recipe, 'corporate-landing');
  assert.deepEqual(f.live(), ['candidate', 'candidate']);
  assert.deepEqual(f.calls, [['published', TARGET.text, data.snapshotId]]);
  assert.equal(versions.list(f.project)[0].id, data.snapshotId);
  const stats = await f.request('/api/metrics');
  assert.equal(stats.data.n, 1);
  assert.equal(stats.data.byStage.compose.p50, 1);
  assert.equal(f.fast.busy(), false);
});

test('unsupported requests enter the normal queue once even while it is busy', async t => {
  const f = fixture(t, { busy: () => true });
  const input = { ...TARGET, text: 'Build a shopping cart' };
  assert.deepEqual(await f.fast.run(input), { accepted: false, fallback: true, id: 7 });
  assert.deepEqual(f.calls, [['fallback', input]]);
  assert.deepEqual(f.live(), ['before', 'before']);
  assert.deepEqual(versions.list(f.project), []);
  await assert.rejects(f.fast.run(TARGET), { status: 409 });
});

test('wrong project, unfinished anchor and invalid JSON preserve the current design', async t => {
  const f = fixture(t);
  const submit = body => f.request('/api/fast', { method: 'POST', body });
  assert.equal((await submit({ ...TARGET, projectId: 'another' })).status, 409);
  assert.equal((await submit('[]')).status, 400);
  assert.equal((await submit({ ...TARGET, text: 'x'.repeat(4100) })).status, 400);
  write(f.project, 'anchors/flow.json', '{}');
  assert.equal((await submit(TARGET)).status, 409);
  assert.deepEqual(f.live(), ['before', 'before']);
  assert.deepEqual(f.calls, []);
});

test('a stalled export times out without changing the live design or history', async t => {
  const f = fixture(t, { deadlineMs: 25, stageFast: ({ stage, signal }) => new Promise((resolve, reject) => {
    stageCandidate(stage);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) });
  await assert.rejects(f.fast.run(TARGET), { status: 504 });
  assert.deepEqual(f.live(), ['before', 'before']);
  assert.deepEqual(versions.list(f.project), []);
  assert.equal(f.fast.busy(), false);
});

test('a newer staged request supersedes the first even if its canceled exporter returns output later', async t => {
  let started, finishFirst;
  const firstStarted = new Promise(resolve => { started = resolve; });
  const f = fixture(t, { stageFast({ stage }) {
    if (finishFirst) return stageCandidate(stage, 'newer');
    return new Promise(resolve => {
      finishFirst = () => resolve(stageCandidate(stage, 'stale'));
      started();
    });
  } });
  const first = f.fast.run(TARGET);
  await firstStarted;
  const rejected = assert.rejects(first, { status: 409, message: /newer request/ });
  assert.equal((await f.fast.run(TARGET)).accepted, true);
  await rejected;
  finishFirst();
  await Promise.resolve();
  assert.deepEqual(f.live(), ['newer', 'newer']);
  assert.equal(versions.list(f.project).length, 1);
  assert.equal(f.calls.length, 1);
});

test('a nested support-file edit while composing stops installation of the stale candidate', async t => {
  const f = fixture(t, { async stageFast({ projectDir, stage }) {
    const result = stageCandidate(stage);
    await Promise.resolve();
    write(projectDir, 'sections/support/data.md', 'External edit');
    return result;
  } });
  write(f.project, 'sections/support/data.md', 'Previous value');
  await assert.rejects(f.fast.run(TARGET), { status: 409, message: /design changed/ });
  assert.equal(fs.readFileSync(path.join(f.project, 'sections/support/data.md'), 'utf8'), 'External edit');
  assert.deepEqual(f.live(), ['before', 'before']);
  assert.deepEqual(versions.list(f.project), []);
});
