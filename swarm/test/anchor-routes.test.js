'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const { crc32, deflateSync } = require('node:zlib');
const { createAnchorRoutes } = require('../lib/anchor-routes');
const { approvedAnchor } = require('../lib/publication');
const anchors = require('../lib/anchors');

const HEADERS = { 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'empty', 'content-type': 'application/json' };
const PASS = { verdict: 'pass', score: 84, findings: ['Clear hierarchy.'] };
const TARGET = 'test-project';

function png(width, value = 0) {
  const chunk = (name, data) => {
    const buffer = Buffer.alloc(data.length + 12);
    buffer.writeUInt32BE(data.length);
    buffer.write(name, 4);
    data.copy(buffer, 8);
    buffer.writeUInt32BE(crc32(buffer.subarray(4, -4)), buffer.length - 4);
    return buffer;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 2;
  const scan = Buffer.alloc(width * 3 + 1, value);
  scan[0] = 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(scan)), chunk('IEND', Buffer.alloc(0))]);
}

function contract() {
  return { version: 1, recipe: 'corporate-landing', brand: 'gjh', tokens: { color: '--text-color' },
    owners: {}, sections: [{id: '01-hero', block: 'hero', slots: { title: 'Shop now' }}],
    rules: { desktop: { columns: 12, typeScale: [16, 24], spacingScale: [8, 16], palette: ['#abc'], imagery: 'Brand photography' } } };
}

function qaReport(ok = true) {
  return { ok, completeCoverage: false, breakpoints: [
    { name: 'desktop', status: ok ? 'pass' : 'fail', score: ok ? 96 : 20, threshold: 80 },
    { name: 'tablet', status: 'missing' }, { name: 'mobile', status: 'missing' },
  ] };
}

async function fixture(t, options = {}) {
  const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-anchor-api-')));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'sections'));
  const section = path.join(project, 'sections', '01-hero.html');
  fs.writeFileSync(section, '<section><h1>Original</h1></section>');
  const events = [];
  const routes = createAnchorRoutes({ projectDir: project, projectId: TARGET, busy: () => false,
    changed: () => events.push('anchor'), reviewAnchor: async () => PASS, captureAnchorQA: async () => qaReport(),
    previewUrl: () => 'http://127.0.0.1:8800/studio.html?preview=1', ...options });
  function call(action, body, headers = HEADERS) {
    const request = Readable.from(body === undefined ? [] : [JSON.stringify({ projectId: TARGET, ...body })]);
    Object.assign(request, { headers, method: body === undefined ? 'GET' : 'POST' });
    return routes.handle(request, {}, '/api/anchor/' + action, (_, status, data, type) => ({ status, data, type }));
  }
  const session = await call('session');
  assert.equal(session.status, 200);
  const post = (action, body) => call(action, body, { ...HEADERS, 'x-swarm-anchor-token': session.data.token });
  const reference = png(1440);
  async function imported() {
    assert.equal((await post('goals', { goals: ['Reduce competing calls to action.'] })).data.flow.state, 'generating');
    const result = await post('import', { files: { desktop: reference.toString('base64') } });
    assert.equal(result.status, 200);
    assert.equal(result.data.flow.state, 'advisor_review');
    return { anchorId: result.data.flow.anchorId, sha256: result.data.anchors[0].files['anchor.desktop.png'].sha256 };
  }
  async function approved() {
    const input = await imported();
    assert.equal((await post('advisor', input)).data.flow.state, 'awaiting_approval');
    assert.equal((await post('approve', input)).data.flow.approved, true);
    return input;
  }
  async function frozen() {
    const input = await approved();
    const result = await post('lock', { ...input, contract: contract() });
    assert.equal(result.status, 200);
    assert.equal(result.data.flow.state, 'locked');
    return input;
  }
  return { project, section, routes, call, post, reference, events, imported, approved, frozen };
}

test('requires a local browser capability and treats the displayed image digest as the approval target', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('session', undefined, { 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'empty' })).status, 403);
  assert.equal((await f.call('goals', { goals: ['Bypass'] })).status, 403);
  assert.equal((await f.post('goals', { projectId: 'another', goals: ['Wrong project'] })).status, 409);
  assert.equal(fs.existsSync(path.join(f.project, 'anchors')), false);
  const anchor = await f.imported();
  assert.equal((await f.post('approve', anchor)).status, 409);
  const preview = await f.call('image/v001/desktop');
  assert.equal(preview.type, 'image/png');
  assert.deepEqual(preview.data, f.reference);
  assert.equal((await f.call('image/v001/tablet')).status, 404);
  assert.equal((await f.post('advisor', { ...anchor, verdict: 'revise', actor: 'system' })).data.anchors[0].advisor.verdict, 'pass');
  assert.equal((await f.post('approve', { ...anchor, sha256: '0'.repeat(64) })).status, 409);
  assert.equal((await f.post('approve', anchor)).data.anchors[0].approvedBy, 'owner');
  const conflict = await f.post('lock', { ...anchor, contract: { ...contract(), rules: {} } });
  assert.equal(conflict.status, 400);
  assert.equal(fs.existsSync(path.join(f.project, 'contract.json')), false);
  const locked = await f.post('lock', { ...anchor, contract: contract() });
  assert.equal(locked.data.flow.state, 'locked');
  assert.equal(approvedAnchor(f.project).id, anchor.anchorId);
  assert.deepEqual(fs.readFileSync(path.join(f.project, 'contract.json')), fs.readFileSync(path.join(f.project, 'anchors/v001/contract.json')));
  assert.equal((await f.post('unlock', { ...anchor, reason: 'Revise the visual direction.' })).data.flow.state, 'generating');
  assert.equal(anchors.get(f.project, anchor.anchorId).status, 'superseded');
  assert.throws(() => approvedAnchor(f.project), /Lock the approved design anchor/);
});

test('PNG intake checks required widths and pixel data before creating an anchor', async t => {
  const f = await fixture(t);
  await f.post('goals', { goals: ['Review a design.'] });
  const broken = Buffer.from(f.reference);
  broken[40] ^= 1;
  for (const desktop of [png(393), broken]) {
    assert.equal((await f.post('import', { files: { desktop: desktop.toString('base64') } })).status, 400);
  }
  assert.deepEqual((await f.call('state')).data.anchors, []);
});

test('generation takes current project goals, verifies three PNGs and enters advisor review without approval', async t => {
  const options = { generateAnchor: async ({ goals }) => {
    assert.deepEqual(goals, ['Use a calm palette.']);
    return { model: 'codex:gpt-6.2-sol', files: { desktop: png(1440), tablet: png(768), mobile: png(393) } };
  } };
  const f = await fixture(t, options);
  assert.equal((await f.post('generate', {})).status, 409);
  assert.equal((await f.post('goals', { goals: ['Use a calm palette.'] })).status, 200);
  const draft = await f.post('generate', { goals: ['Untrusted client override'], model: 'client-model' });
  assert.equal(draft.status, 200);
  assert.equal(draft.data.flow.state, 'advisor_review');
  assert.equal(draft.data.flow.approved, false);
  assert.equal(draft.data.anchors[0].model, 'codex:gpt-6.2-sol');
  assert.equal(draft.data.anchors[0].status, 'draft');
  assert.deepEqual(Object.values(draft.data.anchors[0].files).map(file => file.width), [1440, 768, 393]);
  assert.throws(() => approvedAnchor(f.project), /Lock the approved design anchor/);
});

test('a canceled generation leaves goals ready and avoids writing a draft', async t => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const f = await fixture(t, { generateAnchor: async ({ signal }) => {
    started();
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    return { model: 'codex:gpt-6.2-sol', files: { desktop: png(1440), tablet: png(768), mobile: png(393) } };
  } });
  await f.post('goals', { goals: ['Use a calm palette.'] });
  const pending = f.post('generate', {});
  await ready;
  f.routes.cancel();
  assert.equal((await pending).status, 409);
  const state = (await f.call('state')).data;
  assert.equal(state.flow.state, 'generating');
  assert.deepEqual(state.anchors, []);
});

test('retries an interrupted lock only with its already-frozen contract', async t => {
  const f = await fixture(t);
  const anchor = await f.approved();
  const frozen = anchors.lock(f.project, anchor.anchorId, contract());
  assert.throws(() => approvedAnchor(f.project), /Lock the approved design anchor/);
  const changed = { ...contract(), version: 2 };
  assert.equal((await f.post('lock', { ...anchor, contract: changed })).status, 409);
  assert.equal((await f.post('lock', { ...anchor, contract: contract() })).data.flow.state, 'locked');
  assert.equal(approvedAnchor(f.project).contractHash, frozen.contractSha256);
});

test('advisor revision archives the draft and a new image gets a different version', async t => {
  const f = await fixture(t, { reviewAnchor: async () => ({ verdict: 'revise', score: 52, findings: ['Improve readability.'] }) });
  const anchor = await f.imported();
  const revision = await f.post('advisor', anchor);
  assert.equal(revision.status, 200);
  assert.equal(revision.data.flow.state, 'generating');
  assert.equal(revision.data.flow.advisorRevisions, 1);
  assert.equal(revision.data.anchors[0].status, 'superseded');
  const next = await f.post('import', { files: { desktop: png(1440, 240).toString('base64') } });
  assert.equal(next.data.flow.anchorId, 'v002');
  assert.equal(next.data.anchors.length, 2);
});

test('visual QA tracks missing reference coverage and requires a fresh pass for final approval', async t => {
  let passes = false;
  const f = await fixture(t, { captureAnchorQA: async () => qaReport(passes) });
  const anchor = await f.frozen();
  assert.equal((await f.post('finish', anchor)).status, 409);
  const failed = await f.post('qa', anchor);
  assert.equal(failed.data.flow.state, 'implementing');
  assert.equal(failed.data.flow.qaRevisions, 1);
  passes = true;
  const passed = await f.post('qa', anchor);
  assert.equal(passed.data.flow.state, 'final_review');
  assert.equal(passed.data.qa.completeCoverage, false);
  assert.deepEqual(passed.data.qa.breakpoints.map(item => item.status), ['pass', 'missing', 'missing']);
  fs.appendFileSync(f.section, '\n');
  assert.equal((await f.call('state')).data.qa.stale, true);
  assert.equal((await f.post('finish', anchor)).status, 409);
  assert.equal((await f.post('qa', anchor)).data.flow.state, 'final_review');
  assert.equal((await f.post('finish', anchor)).data.flow.state, 'done');
  assert.equal((await f.post('qa', anchor)).data.flow.state, 'final_review');
});

test('design drift during capture and cancellation prevent published QA and concurrent anchor writes', async t => {
  let f;
  let start, finish;
  let started = new Promise(resolve => { start = resolve; });
  f = await fixture(t, { captureAnchorQA: ({ signal }) => new Promise(resolve => {
    finish = resolve;
    signal.addEventListener('abort', () => resolve(qaReport()), { once: true });
    start();
  }) });
  const anchor = await f.frozen();
  const current = f.post('qa', anchor);
  await started;
  assert.equal((await f.call('state')).data.busy, true);
  assert.equal((await f.post('unlock', { ...anchor, reason: 'Concurrent write.' })).status, 409);
  fs.appendFileSync(f.section, '\n');
  finish(qaReport());
  assert.equal((await current).status, 409);
  assert.equal((await f.call('state')).data.qa, null);
  started = new Promise(resolve => { start = resolve; });
  const pending = f.post('qa', anchor);
  await started;
  f.routes.cancel();
  assert.equal((await pending).status, 409);
  assert.equal((await f.call('state')).data.flow.state, 'locked');
  assert.equal(f.routes.busy(), false);
});
