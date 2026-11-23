'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const store = require('../lib/shared-tokens');
const { createSharedRoutes } = require('../lib/shared-routes');
const { createPublication } = require('../lib/publication');
const { AnchorRequestError } = require('../lib/anchor-manager');
const integrator = require('../lib/integrator');
const ownership = require('../lib/ownership');

const CSS = '/* ; --ink: red; */\n:root { --ink: #112233; --font: "A; --ink: no;"; }\n@media (prefers-color-scheme: dark) { :root { --ink: #fff; } }\n';
const SECTIONS = [{ id: '01-header', owner: '01' }, { id: '02-hero', owner: '02' }];
const META = { sectionId: '01-header', workerId: '01', projectId: 'test-project', anchor: null,
  appearance: { theme: 'dark', lang: 'ms', brand: 'none', colorScheme: 'light' } };
const EDITS = [{ name: '--ink', occurrence: 1, value: '#def' }];
const BASE = '/api/shared-proposals';

function fixture(t) {
  const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-shared-test-')));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'sections'));
  fs.writeFileSync(path.join(project, 'tokens.css'), CSS, { mode: 0o640 });
  const peer = path.join(project, 'sections/02-hero.html');
  for (const { id } of SECTIONS) fs.writeFileSync(path.join(project, 'sections', id + '.html'),
    `<section class="s-${id.slice(0, 2)}" id="${id}">${id}</section>`);
  const manifest = ownership.build({ launchContext: true, agents: [{ id: '01', section: 'header' }, { id: '02', section: 'hero' }] });
  const publish = createPublication(project).publish;
  const events = [];
  const f = { project, peer, events, report: { digest: 'a'.repeat(64), ok: true, evidence: {
    393: { before: Buffer.from('original'), after: Buffer.from('candidate'),
      sections: { '01-header': { before: Buffer.from('header'), after: Buffer.from('new header') } } } },
  } };
  f.request = async (edits = EDITS, alter = () => {}) => {
    const ws = integrator.open(project, '01', manifest);
    try {
      fs.writeFileSync(path.join(ws.dir, 'token-proposal.json'), JSON.stringify(edits));
      alter(ws.dir);
      const draft = store.takeRequest(ws, META);
      const result = await publish(ws, { owner: META.sectionId, workerId: META.workerId, anchor: null,
        cancelled: () => false, checkOutbox() {}, sharedProposal: draft });
      return { ...result, id: draft.id };
    } finally { integrator.close(ws); }
  };
  f.routes = createSharedRoutes({ projectDir: project, projectId: META.projectId, sections: () => SECTIONS,
    busy: () => false, changed: action => events.push(action), authorize(req) {
      if (!req.headers['x-swarm-anchor-token']) throw new AnchorRequestError(403, 'Operator session required.');
    }, measure: async (...args) => {
      assert.deepEqual(args[2].expectedSections, SECTIONS.map(s => s.id));
      assert.equal(fs.readFileSync(path.join(args[0], 'tokens.css'), 'utf8'), CSS);
      assert.equal(fs.readFileSync(path.join(args[1], 'tokens.css'), 'utf8'), CSS.replace('#fff', '#def'));
      await f.onMeasure?.(...args);
      return f.report;
    },
  });
  f.call = (suffix = '', proposal, token = true) => {
    const body = proposal && { id: proposal.id, reviewRevision: proposal.reviewRevision, projectId: META.projectId };
    const req = Readable.from(body ? [JSON.stringify(body)] : []);
    req.method = body ? 'POST' : 'GET';
    req.headers = { 'content-type': 'application/json', 'x-swarm-anchor-token': token };
    return f.routes.handle(req, {}, new URL(BASE + suffix, 'http://localhost'), (_, status, data) => ({ status, data }));
  };
  return f;
}

test('holds a vetted proposal across workspace cleanup and atomically records an explicit decision', async t => {
  const f = fixture(t);
  const { id, ok } = await f.request();
  assert.equal(ok, true);
  const [pending] = (await f.call()).data.proposals;
  assert.equal(pending.id, id);
  assert.equal(pending.before, CSS);
  assert.equal(pending.after, CSS.replace('#fff', '#def'));
  const live = () => fs.readFileSync(path.join(f.project, 'tokens.css'), 'utf8');
  assert.equal(live(), CSS);
  assert.equal((await f.call('/approve', pending)).status, 409);
  assert.equal((await f.call('/review', pending, false)).status, 403);
  const reviewed = (await f.call('/review', pending)).data.proposal;
  assert.equal(live(), CSS);
  assert.notEqual(reviewed.reviewRevision, pending.reviewRevision);
  const crop = await f.call(`/${id}/evidence/${reviewed.reviewRevision}/393/after?section=01-header`);
  assert.equal(crop.data.toString(), 'new header');
  assert.equal((await f.call('/approve', pending)).status, 409);
  const approved = (await f.call('/approve', reviewed)).data.proposal;
  assert.equal(approved.decision.by, 'studio-operator');
  assert.equal(approved.status, 'approved');
  assert.equal(live(), CSS.replace('#fff', '#def'));
  assert.equal(fs.statSync(path.join(f.project, 'tokens.css')).mode & 0o777, 0o640);
  assert.equal(fs.readFileSync(path.join(f.project, '.run/component-snapshots', approved.decision.undoSnapshotId, 'files/tokens.css'), 'utf8'), CSS);
  assert.equal((await f.call('/approve', reviewed)).status, 409);
  assert.deepEqual((await f.call()).data.proposals[0], approved);
});

test('rejects stale review inputs, changed measurements, cancelled capture and failed impact', async t => {
  const f = fixture(t);
  await f.request();
  const [pending] = (await f.call()).data.proposals;
  let reviewed = (await f.call('/review', pending)).data.proposal;
  fs.appendFileSync(f.peer, ' ');
  assert.equal((await f.call('/approve', reviewed)).status, 409);
  assert.equal((await f.call()).data.proposals[0].status, 'stale');
  reviewed = (await f.call('/review', reviewed)).data.proposal;
  f.report.digest = 'b'.repeat(64);
  assert.equal((await f.call('/approve', reviewed)).status, 409);
  f.onMeasure = async () => {
    assert.equal((await f.call('/reject', reviewed)).status, 409);
    f.routes.cancel();
  };
  assert.equal((await f.call('/review', reviewed)).status, 409);
  f.onMeasure = null;
  f.report.ok = false;
  f.report.evidence[393].sections['01-header'].after = null;
  reviewed = (await f.call('/review', reviewed)).data.proposal;
  assert.equal(reviewed.impact.ok, false);
  assert.equal((await f.call('/approve', reviewed)).status, 409);
  assert.equal((await f.call('/reject', reviewed)).data.proposal.status, 'rejected');
  assert.equal((await f.call('/review', reviewed)).status, 409);
  assert.equal(fs.readFileSync(path.join(f.project, 'tokens.css'), 'utf8'), CSS);
});

test('validates worker edits and discards proposals from failed publications', async t => {
  const f = fixture(t);
  for (const item of [
    { name: '--bogus', value: 'red' }, { name: '--ink', value: '1; color:red' },
    { name: '--ink', value: 'url(https://example.invalid)' }, { name: '--ink', occurrence: 9, value: 'red' },
    { name: '--ink', value: 'calc(1px' }, { name: '--ink', value: 'red', path: 'other.css' },
  ]) await assert.rejects(f.request([item]), /token|CSS/);
  const rejected = await f.request(EDITS, root => fs.writeFileSync(path.join(root, 'sections/02-hero.css'), '.s-02 { color: teal; }'));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.rejected[0].code, 'foreign');
  await assert.rejects(f.request(EDITS, root => {
    const file = path.join(root, 'tokens.css');
    fs.chmodSync(file, 0o600);
    fs.writeFileSync(file, ':root{}');
  }), /original shared/);
  assert.deepEqual((await f.call()).data.proposals, []);
});
