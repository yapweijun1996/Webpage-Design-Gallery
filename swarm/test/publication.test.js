'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createFlow } = require('../lib/anchorflow');
const anchors = require('../lib/anchors');
const { createChat } = require('../lib/chat');
const integrator = require('../lib/integrator');
const { build } = require('../lib/ownership');
const { approvedAnchor, canRestore, createPublication } = require('../lib/publication');
const versions = require('../lib/versions');

const WORKER = '01';
const OWNER = '01-hero';
const SECTION = 'sections/01-hero.html';
const PEER = 'sections/02-about.html';
const NOTES = 'notes/01.md';
const OUTBOX = 'chat/01.jsonl';
const AUDIT = 'integration/log.jsonl';
const DESKTOP = 'anchor.desktop.png';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAABaAAAAACCAAAAACLJyRWAAAAGklEQVR4nO3BgQAAAADDoPlTX+EAVQEAAL8BC0IAARLjJg4AAAAASUVORK5CYII=',
  'base64',
);
const PEOPLE = [
  { id: '00', name: 'Manager' },
  { id: WORKER, section: 'hero', name: 'Hero' },
  { id: '02', section: 'about', name: 'About' },
];
const ORIGINAL = '<section class="s-01" id="01-hero"><h1>Original hero</h1></section>\n';
const REVISION = ORIGINAL.replace('Original', 'Revised');
const ORIGINAL_PEER = '<section class="s-02" id="02-about"><h2>About</h2></section>\n';
const NOTE = 'Approved workspace note.\n';
const MESSAGE = 'Candidate hero revision.';

function write(dir, file, contents) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), contents);
}

function read(dir, file) {
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

function fixture(t, impact = () => assert.fail('Unexpected browser check.')) {
  const project = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-publication-api-')));
  const workspaces = [];
  const events = [];
  write(project, SECTION, ORIGINAL);
  write(project, PEER, ORIGINAL_PEER);
  write(project, NOTES, 'Existing note.\n');
  const chat = createChat({ projectDir: project, agents: PEOPLE, emit: event => events.push(event), workspaceOutboxes: true });
  chat.start();
  chat.post({ from: 'owner', text: 'Revise the hero.' });
  t.after(() => {
    chat.stop();
    try { workspaces.forEach(integrator.close); }
    finally { fs.rmSync(project, { recursive: true, force: true }); }
  });
  const publication = createPublication(project, impact);
  const initialChannel = read(project, 'channel.jsonl');
  const initialTranscript = read(project, 'channel.md');
  return {
    project, chat, events, initialChannel, initialTranscript,
    open({ visual = true, note = false, message = MESSAGE, kind = 'done' } = {}) {
      const ws = integrator.open(project, WORKER, build({ agents: PEOPLE, launchContext: true }));
      workspaces.push(ws);
      if (visual) write(ws.dir, SECTION, REVISION);
      if (note) write(ws.dir, NOTES, NOTE);
      write(ws.dir, OUTBOX, JSON.stringify({ kind, text: message }) + '\n');
      return ws;
    },
    async publish(ws, anchor = null, appearance) {
      const result = await publication.publish(ws, {
        anchor, appearance, owner: OWNER, workerId: WORKER, cancelled: () => false,
        checkOutbox: outbox => chat.validateWorkerOutbox(WORKER, outbox),
      });
      if (result.ok) chat.publishWorker(WORKER, result.outbox);
      return result;
    },
  };
}

function transition(flow, event, actor, fields = {}) {
  const result = flow.dispatch(event, { actor, ...fields });
  assert.equal(result.ok, true, result.error);
}

function lockAnchor(project, title = 'Example product') {
  const flow = createFlow(project);
  if (flow.state().state === 'goals') transition(flow, 'set_goals', 'manager', { goals: [title] });
  const { id, dir } = anchors.create(project, { files: { desktop: PNG } });
  const contract = {
    version: 0,
    recipe: 'corporate-landing',
    brand: 'example',
    tokens: { accent: '#215eda' },
    sections: [{ id: 'hero', block: 'hero', slots: { title } }],
    owners: {},
    rules: { desktop: { columns: 12, typeScale: [16, 32], spacingScale: [4, 8], palette: ['#215eda'], imagery: 'Wide hero' } },
  };
  transition(flow, 'anchor_ready', 'system', { anchorId: id });
  transition(flow, 'advisor_pass', 'advisor');
  anchors.approve(project, id, { by: 'manager' });
  transition(flow, 'approve', 'manager', { anchorId: id });
  anchors.lock(project, id, contract);
  transition(flow, 'lock', 'manager', { anchorId: id });
  const lockedContract = fs.readFileSync(path.join(dir, 'contract.json'));
  write(project, 'contract.json', lockedContract);
  return { id, dir, flow, lockedContract };
}

function impactReport({ unexpected = [], overflow = 0, errors = [] } = {}) {
  return { ok: unexpected.length === 0, unexpected, perWidth: [{
    width: 393, horizontalOverflow: { before: 0, after: overflow }, consoleErrors: { added: errors },
  }] };
}

function assertRejected(f, result, code, message) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.merged, []);
  assert.equal(result.snapshotId, null);
  assert.equal(result.outbox, null);
  assert.equal(result.rejected[0].code, code);
  assert.match(result.rejected[0].message, message);
  assert.equal(read(f.project, SECTION), ORIGINAL);
  assert.equal(read(f.project, PEER), ORIGINAL_PEER);
  assert.equal(read(f.project, NOTES), 'Existing note.\n');
  assert.equal(read(f.project, 'channel.jsonl'), f.initialChannel);
  assert.equal(read(f.project, 'channel.md'), f.initialTranscript);
  assert.deepEqual(f.chat.history().map(({ from }) => from), ['owner']);
  assert.equal(f.events.filter(({ type }) => type === 'chat').length, 1);
  assert.equal(fs.existsSync(path.join(f.project, AUDIT)), false);
}

for (const [name, check, message] of [
  ['a peer section changing', () => impactReport({ unexpected: ['02-about'] }), /other sections: 02-about/],
  ['new horizontal overflow', () => impactReport({ overflow: 5 }), /horizontal overflow/],
  ['a new browser error', () => impactReport({ errors: ['Error: render failed'] }), /browser errors/],
  ['missing expected Studio evidence', () => ({ ...impactReport(), ok: false }), /every expected section/],
  ['a browser capture failure', () => { throw new Error('Unavailable browser.'); }, /Chrome could not verify/],
]) {
  test(`publication keeps live files and channel history when the browser reports ${name}`, async t => {
    const f = fixture(t, check);
    const result = await f.publish(f.open({ note: true }));
    assertRejected(f, result, 'impact', message);
  });
}

test('replacing a valid locked active anchor after launch rejects visual edits and outbox before rendering', async t => {
  let checked = false;
  const f = fixture(t, () => { checked = true; return impactReport(); });
  const first = lockAnchor(f.project);
  const launched = approvedAnchor(f.project);
  const ws = f.open({ note: true });
  transition(first.flow, 'unlock', 'manager', { anchorId: first.id, reason: 'New direction.' });
  const second = lockAnchor(f.project, 'Revised product');
  assert.equal(approvedAnchor(f.project).id, second.id);
  const result = await f.publish(ws, launched);
  assertRejected(f, result, 'anchor', /anchor changed during this turn/);
  assert.equal(checked, false);
});

test('publication freezes the worker appearance before entering the review queue', async t => {
  const requested = { theme: 'dark', brand: 'forest-gold', lang: 'ms', colorScheme: 'light' };
  const f = fixture(t, (_before, _after, { appearance }) => {
    assert.deepEqual(appearance, { theme: 'dark', brand: 'forest-gold', lang: 'ms', colorScheme: 'light' });
    assert.equal(Object.isFrozen(appearance), true);
    return impactReport();
  });
  const finished = f.publish(f.open(), null, requested);
  requested.theme = 'light';
  assert.equal((await finished).ok, true);
});

test('a changed locked anchor file during browser checks preserves the live project and channel', async t => {
  const f = fixture(t, async () => {
    await Promise.resolve();
    const image = path.join(locked.dir, DESKTOP);
    fs.chmodSync(image, 0o644);
    fs.writeFileSync(image, Buffer.concat([PNG, Buffer.from([0])]));
    fs.chmodSync(image, 0o444);
    return impactReport();
  });
  const locked = lockAnchor(f.project);
  const result = await f.publish(f.open({ note: true }), approvedAnchor(f.project));
  assertRejected(f, result, 'stale', /live preview inputs changed/);
  assert.equal(result.rejected[0].path, `anchors/${locked.id}/${DESKTOP}`);
});

test('visual publication stages the approved anchor, commits the candidate and records the matching audit', async t => {
  const capture = [];
  const f = fixture(t, (before, after, options) => {
    capture.push({
      original: read(before, SECTION), candidate: read(after, SECTION), peer: read(after, PEER), options,
      anchorImage: fs.readFileSync(path.join(after, 'anchors', locked.id, DESKTOP)),
      anchoredContract: fs.readFileSync(path.join(after, 'anchors', locked.id, 'contract.json')),
      outboxStagedInPreview: fs.existsSync(path.join(after, OUTBOX)),
    });
    return impactReport();
  });
  const locked = lockAnchor(f.project);
  const approval = approvedAnchor(f.project);
  const result = await f.publish(f.open(), approval);
  assert.equal(result.ok, true, JSON.stringify(result.rejected));
  assert.deepEqual(capture, [{
    original: ORIGINAL, candidate: REVISION, peer: ORIGINAL_PEER, options: { owner: OWNER, firstBuild: false },
    anchorImage: PNG, anchoredContract: locked.lockedContract, outboxStagedInPreview: false,
  }]);
  assert.deepEqual(result.merged, [SECTION]);
  assert.equal(read(f.project, SECTION), REVISION);
  assert.equal(read(f.project, PEER), ORIGINAL_PEER);
  assert.equal(fs.existsSync(path.join(f.project, OUTBOX)), false);
  assert.deepEqual(f.chat.history().map(({ from, text }) => [from, text]), [['owner', 'Revise the hero.'], [WORKER, MESSAGE]]);
  const { at, ...audit } = JSON.parse(read(f.project, AUDIT));
  assert.equal(at, new Date(at).toISOString());
  assert.deepEqual(audit, {
    owner: WORKER, snapshotId: result.snapshotId, paths: [SECTION],
    anchorId: locked.id, anchorContractSha256: approval.contractHash, projectContractSha256: approval.contractHash,
  });
});

test('publication identifies a new section built from the standard project scaffold', async t => {
  const calls = [];
  const f = fixture(t, (_before, _after, options) => {
    calls.push(options);
    return impactReport();
  });
  write(f.project, SECTION, '<section class="s-01" id="01-hero"></section>\n');
  const result = await f.publish(f.open());
  assert.equal(result.ok, true, JSON.stringify(result.rejected));
  assert.deepEqual(calls, [{ owner: OWNER, firstBuild: true }]);
  assert.equal(read(f.project, SECTION), REVISION);
});

test('docs and outbox-only publication work during anchor planning without invoking the browser', async t => {
  const f = fixture(t);
  const flow = createFlow(f.project);
  transition(flow, 'set_goals', 'manager', { goals: ['Choose a visual direction.'] });
  assert.throws(() => approvedAnchor(f.project), /Lock the approved design anchor/);

  const docs = await f.publish(f.open({ visual: false, note: true }));
  assert.equal(docs.ok, true, JSON.stringify(docs.rejected));
  assert.deepEqual(docs.merged, [NOTES]);
  assert.equal(read(f.project, NOTES), NOTE);
  assert.equal(read(f.project, SECTION), ORIGINAL);
  const audit = read(f.project, AUDIT);
  assert.equal(JSON.parse(audit).anchorId, null);

  const post = await f.publish(f.open({ visual: false, message: 'Follow-up note.' }));
  assert.equal(post.ok, true, JSON.stringify(post.rejected));
  assert.deepEqual(post.merged, []);
  assert.equal(post.snapshotId, null);
  assert.equal(read(f.project, AUDIT), audit);
  assert.deepEqual(f.chat.history().map(({ text }) => text), ['Revise the hero.', MESSAGE, 'Follow-up note.']);
});

test('invalid worker outbox rejects the entire candidate before the browser check', async t => {
  const f = fixture(t);
  const result = await f.publish(f.open({ note: true, kind: 'assign' }));
  assertRejected(f, result, 'channel', /invalid message/);
});

test('version rollback requires the matching contract while the real anchor flow is locked', t => {
  const { project } = fixture(t);
  const relativeCandidate = '.run/restore-candidate';
  const candidate = path.join(project, relativeCandidate);
  fs.mkdirSync(candidate, { recursive: true });
  assert.equal(canRestore(project, candidate), true);

  write(project, 'contract.json', '{"anchors":"old"}\n');
  const old = versions.snapshot(project, 'Old design');
  const locked = lockAnchor(project);
  const matching = versions.snapshot(project, 'Locked design');
  write(project, SECTION, REVISION);
  const check = ({ source }) => canRestore(project, source);
  assert.match(canRestore(project, candidate), /locked design contract/);
  assert.throws(() => versions.rollback(project, old, { backupLabel: 'Undo', canRestore: check }), versions.VersionRestoreBlockedError);
  assert.deepEqual(new Set(versions.list(project).map(({ id }) => id)), new Set([old, matching]));
  assert.equal(read(project, SECTION), REVISION);
  assert.deepEqual(fs.readFileSync(path.join(project, 'contract.json')), locked.lockedContract);

  const undoId = versions.rollback(project, matching, { backupLabel: 'Undo', canRestore: check });
  assert.ok(undoId);
  assert.equal(read(project, SECTION), ORIGINAL);
  assert.deepEqual(fs.readFileSync(path.join(project, 'contract.json')), locked.lockedContract);
  transition(locked.flow, 'unlock', 'manager', { anchorId: locked.id, reason: 'Return to design planning.' });
  assert.throws(() => versions.rollback(project, matching, { canRestore: check }), /Lock the approved design anchor/);
});
