'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const { createVersionRoutes } = require('../lib/version-routes');

function fixture(t, options = {}) {
  const projectDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-version-api-')));
  t.after(() => fs.rmSync(projectDir, { force: true, recursive: true }));
  const section = path.join(projectDir, 'sections', '01-hero.html');
  fs.mkdirSync(path.dirname(section));
  const route = createVersionRoutes({ projectDir, projectId: 'fixture', busy: () => false, ...options });
  const request = (url, method = 'GET', input, contentType = 'application/json') => {
    const payload = input instanceof Readable ? input : Readable.from(input === undefined ? [] : [JSON.stringify(input)]);
    payload.method = method;
    payload.headers = { 'content-type': contentType };
    return route(payload, {}, url, (_, status, body) => ({ status, body }));
  };
  return { projectDir, section, request, state: async () => (await request('/api/versions')).body };
}

test('version routes publish one notification per mutation, including an exact rollback and undo', async t => {
  const changes = [];
  const f = fixture(t, { changed: event => changes.push(event) });
  fs.writeFileSync(f.section, 'saved');
  assert.deepEqual(await f.state(), { projectId: 'fixture', busy: false, versions: [] });
  const saved = await f.request('/api/versions', 'POST', { projectId: 'fixture', label: '  My draft  ' });
  assert.equal(saved.status, 200);
  const id = saved.body.id;
  assert.equal((await f.state()).versions[0].label, 'My draft');

  fs.writeFileSync(f.section, 'before restore');
  const result = await f.request('/api/rollback', 'POST', { projectId: 'fixture', id });
  assert.equal(result.status, 200);
  assert.equal(fs.readFileSync(f.section, 'utf8'), 'saved');
  const undoId = result.body.undoId;
  assert.deepEqual((await f.state()).versions.map(version => version.id), [undoId, id]);
  assert.deepEqual(changes, [{ type: 'snapshot', id }, { type: 'rollback', id, undoId }]);
  assert.equal((await f.request('/api/rollback', 'POST', { projectId: 'fixture', id: undoId })).status, 200);
  assert.equal(fs.readFileSync(f.section, 'utf8'), 'before restore');
});

test('identity, project lock, active turns and anchor policy prevent a version write', async t => {
  let active = false;
  const changes = [];
  const f = fixture(t, {
    busy: () => active,
    canRestore: ({ source }) => fs.readFileSync(path.join(source, 'sections', '01-hero.html'), 'utf8') !== 'old' || 'The anchor changed.',
    changed: event => changes.push(event),
  });
  fs.writeFileSync(f.section, 'old');
  assert.equal((await f.request('/api/versions', 'POST', { projectId: 'another-project' })).status, 409);
  assert.equal((await f.request('/api/versions', 'POST', { projectId: 'fixture' }, 'text/plain')).status, 415);
  assert.equal((await f.request('/api/versions', 'POST', { projectId: 'fixture', label: 'x'.repeat(2048) })).status, 413);
  const lock = path.join(path.dirname(f.projectDir), `.${path.basename(f.projectDir)}.init`);
  fs.mkdirSync(lock);
  try {
    assert.equal((await f.request('/api/versions', 'POST', { projectId: 'fixture' })).status, 409);
  } finally { fs.rmSync(lock, { recursive: true }); }
  const body = Readable.from((async function* () {
    active = true;
    yield '{"projectId":"fixture"}';
  })());
  assert.equal((await f.request('/api/versions', 'POST', body)).status, 409);
  assert.equal((await f.state()).busy, true);
  active = false;
  assert.deepEqual((await f.state()).versions, []);

  const saved = await f.request('/api/versions', 'POST', { projectId: 'fixture' });
  fs.writeFileSync(f.section, 'current');
  assert.equal((await f.request('/api/rollback', 'POST', { projectId: 'fixture', id: '..' })).status, 400);
  assert.equal((await f.request('/api/rollback', 'POST', { projectId: 'fixture', id: '1234567890123-00000000-0000-0000-0000-000000000000' })).status, 404);
  assert.deepEqual(await f.request('/api/rollback', 'POST', { projectId: 'fixture', id: saved.body.id }), {
    status: 409, body: { error: 'The anchor changed.' },
  });
  assert.equal(fs.readFileSync(f.section, 'utf8'), 'current');
  assert.equal((await f.state()).versions.length, 1);
  assert.deepEqual(changes.map(change => change.type), ['snapshot']);
});
