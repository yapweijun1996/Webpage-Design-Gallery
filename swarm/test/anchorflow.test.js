'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { createFlow } = require('../lib/anchorflow');

const MAIN_PATH = [
  ['set_goals', 'manager', 'generating', { goals: ['Show the product'] }],
  ['anchor_ready', 'system', 'advisor_review', { anchorId: 'v001' }],
  ['advisor_pass', 'advisor', 'awaiting_approval'],
  ['approve', 'manager', 'awaiting_approval', { anchorId: 'v001' }],
  ['lock', 'manager', 'locked', { anchorId: 'v001' }],
  ['start_implementation', 'system', 'implementing'],
  ['finish', 'system', 'qa'],
  ['qa_pass', 'system', 'final_review'],
  ['finish', 'manager', 'done'],
];

const LEGAL = [
  { set_goals: ['manager'] },
  { anchor_ready: ['system'] },
  { advisor_pass: ['advisor'], advisor_revise: ['advisor'] },
  { approve: ['manager'], request_revision: ['manager'] },
  { lock: ['manager'], request_revision: ['manager'] },
  { start_implementation: ['system'], unlock: ['manager'] },
  { finish: ['system'] },
  { qa_pass: ['system'], qa_fail: ['system'] },
  { finish: ['manager'], check_again: ['system'] },
  { check_again: ['system'] },
  { retry: ['manager'] },
];

function fixture(t) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-anchorflow-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const dir = path.join(project, 'anchors');
  return { project, dir, file: path.join(dir, 'flow.json'), log: path.join(dir, 'log.jsonl'), flow: createFlow(project) };
}

function apply(flow, [event, actor, state, payload]) {
  const result = flow.dispatch(event, { actor, ...payload });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.state, state, event);
  assert.deepEqual(flow.state(), result.state);
  return result.state;
}

function advance(flow, count) {
  for (const entry of MAIN_PATH.slice(0, count)) apply(flow, entry);
}

function logs(log) {
  const text = fs.readFileSync(log, 'utf8');
  assert.equal(text.endsWith('\n'), true);
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}

function diskFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().map(name => [name, fs.readFileSync(path.join(dir, name))]);
}

test('a new project starts at goals without writing state or log', t => {
  const { dir, flow } = fixture(t);
  assert.deepEqual(flow.state(), {
    state: 'goals', goals: null, anchorId: null, approved: false, advisorRevisions: 0, qaRevisions: 0, failure: null,
  });
  assert.equal(flow.canImplement(), false);
  assert.deepEqual(diskFiles(dir), []);
  assert.equal(flow.dispatch('set_goals', { actor: 'advisor' }).ok, false);
  assert.equal(fs.existsSync(dir), false);
});

test('persists all main transitions and appends one timestamped JSON line per accepted event', t => {
  const { project, file, log, flow } = fixture(t);
  advance(flow, MAIN_PATH.length);
  const reopened = createFlow(project);
  assert.deepEqual(reopened.state(), flow.state());
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).state, 'done');
  assert.deepEqual(reopened.state().goals, ['Show the product']);
  assert.equal(reopened.state().anchorId, 'v001');
  assert.equal(reopened.state().approved, true);

  const actual = logs(log);
  assert.equal(actual.length, MAIN_PATH.length);
  let from = 'goals';
  for (let i = 0; i < MAIN_PATH.length; i += 1) {
    const [event, actor, to] = MAIN_PATH[i];
    const { ts, ...entry } = actual[i];
    assert.equal(ts, new Date(ts).toISOString());
    assert.deepEqual(entry, { from, to, event, actor });
    from = to;
  }
});

test('implements only from locked through done and closes the gate on failure or Manager unlock', t => {
  const { flow, log } = fixture(t);
  assert.equal(flow.canImplement(), false);
  for (let i = 0; i < MAIN_PATH.length; i += 1) {
    apply(flow, MAIN_PATH[i]);
    assert.equal(flow.canImplement(), i >= 4, MAIN_PATH[i][2]);
    if (i === 4) {
      const failed = apply(flow, ['fail', 'system', 'failed', { reason: 'Preview crashed' }]);
      assert.deepEqual(failed.failure, { from: 'locked', reason: 'Preview crashed' });
      assert.equal(flow.canImplement(), false);
      apply(flow, ['retry', 'manager', 'locked']);
      assert.equal(flow.canImplement(), true);
    }
  }
  const { flow: other, log: otherLog } = fixture(t);
  advance(other, 5);
  const unlocked = apply(other, ['unlock', 'manager', 'generating', { reason: 'Change direction', anchorId: 'v001' }]);
  assert.equal(unlocked.approved, false);
  assert.equal(unlocked.anchorId, null);
  assert.equal(other.canImplement(), false);
  assert.equal(logs(log).length, MAIN_PATH.length + 2);
  const { ts, ...entry } = logs(otherLog).at(-1);
  assert.equal(ts, new Date(ts).toISOString());
  assert.deepEqual(entry, { event: 'unlock', actor: 'manager', from: 'locked', to: 'generating' });
});

test('rejects every illegal event and wrong actor without changing either file', t => {
  const events = [
    'set_goals', 'anchor_ready', 'advisor_pass', 'advisor_revise', 'approve', 'request_revision', 'lock',
    'start_implementation', 'qa_pass', 'qa_fail', 'finish', 'check_again', 'fail', 'retry', 'unlock', 'unknown',
  ];
  const actors = [undefined, 'manager', 'advisor', 'system', 'worker', 'owner', 'claude', 'qa', 'constructor'];
  let rejected = 0;
  for (let i = 0; i < LEGAL.length; i += 1) {
    const { flow, dir } = fixture(t);
    advance(flow, i);
    if (i === LEGAL.length - 1) apply(flow, ['fail', 'manager', 'failed', { reason: 'For the matrix' }]);
    const expected = flow.state();
    const before = diskFiles(dir);

    for (const event of events) {
      const allowed = event === 'fail' ? ['manager', 'system'] : LEGAL[i][event] ?? [];
      for (const actor of actors) {
        if (allowed.includes(actor)) continue;
        const response = flow.dispatch(event, { actor, reason: 'For the matrix' });
        const label = `${expected.state} / ${event} / ${actor}`;
        assert.equal(response.ok, false, label);
        assert.equal(typeof response.error, 'string', label);
        assert.deepEqual(response.state, expected, label);
        assert.deepEqual(flow.state(), expected, label);
        assert.deepEqual(diskFiles(dir), before, label);
        rejected += 1;
      }
    }
  }
  assert.equal(rejected, 1545);
});

test('fails from every phase and retries the exact prior snapshot', t => {
  for (let i = 0; i <= MAIN_PATH.length; i += 1) {
    const { project, flow, log } = fixture(t);
    advance(flow, i);
    const before = flow.state();
    const role = i % 2 ? 'system' : 'manager';
    const failed = apply(flow, ['fail', role, 'failed', { reason: 'Interrupted' }]);
    assert.deepEqual(failed, { ...before, state: 'failed', failure: { from: before.state, reason: 'Interrupted' } });
    const reopened = createFlow(project);
    assert.equal(reopened.canImplement(), false);
    assert.deepEqual(apply(reopened, ['retry', 'manager', before.state]), before);
    assert.equal(logs(log).length, i + 2);
  }
});

test('failure requires a reason and repeated failures preserve the original retry phase', t => {
  const { flow, dir, log } = fixture(t);
  advance(flow, 2);
  const before = diskFiles(dir);
  for (const reason of [undefined, '', ' ', false, { reason: 'Nested' }]) {
    assert.equal(flow.dispatch('fail', { actor: 'system', reason }).ok, false);
    assert.deepEqual(diskFiles(dir), before);
  }

  apply(flow, ['fail', 'system', 'failed', { reason: 'First' }]);
  const result = apply(flow, ['fail', 'manager', 'failed', { reason: 'Second' }]);
  assert.deepEqual(result.failure, { from: 'advisor_review', reason: 'Second' });
  apply(flow, ['retry', 'manager', 'advisor_review']);
  assert.deepEqual(logs(log).slice(-3).map(({ from, to }) => [from, to]), [
    ['advisor_review', 'failed'], ['failed', 'failed'], ['failed', 'advisor_review'],
  ]);
});

test('allows three Advisor revisions and carries the limit through failure and retry', t => {
  const { project, flow, dir } = fixture(t);
  advance(flow, 2);
  for (let i = 1; i <= 3; i += 1) {
    const revised = apply(flow, ['advisor_revise', 'advisor', 'generating']);
    assert.equal(revised.advisorRevisions, i);
    assert.equal(revised.anchorId, null);
    apply(flow, ['anchor_ready', 'system', 'advisor_review', { anchorId: `v00${i + 1}` }]);
  }
  apply(flow, ['fail', 'system', 'failed', { reason: 'Temporary' }]);
  const reopened = createFlow(project);
  apply(reopened, ['retry', 'manager', 'advisor_review']);
  const before = diskFiles(dir);
  const rejected = reopened.dispatch('advisor_revise', { actor: 'advisor' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /revision limit/);
  assert.deepEqual(diskFiles(dir), before);
  apply(reopened, ['advisor_pass', 'advisor', 'awaiting_approval']);
});

test('Manager revisions are unlimited and each generated anchor needs a new approval', t => {
  const { flow, dir, log } = fixture(t);
  advance(flow, 3);
  for (let i = 0; i < 7; i += 1) {
    if (i % 2 === 0) apply(flow, ['approve', 'manager', 'awaiting_approval']);
    const revised = apply(flow, ['request_revision', 'manager', 'generating']);
    assert.equal(revised.anchorId, null);
    assert.equal(revised.approved, false);
    assert.equal(revised.advisorRevisions, 0);
    assert.equal(revised.qaRevisions, 0);
    apply(flow, ['anchor_ready', 'system', 'advisor_review', { anchorId: `v00${i + 2}` }]);
    apply(flow, ['advisor_pass', 'advisor', 'awaiting_approval']);
  }
  const before = diskFiles(dir);
  assert.equal(flow.dispatch('lock', { actor: 'manager' }).ok, false);
  assert.deepEqual(diskFiles(dir), before);
  apply(flow, ['approve', 'manager', 'awaiting_approval']);
  apply(flow, ['lock', 'manager', 'locked']);
  assert.equal(logs(log).filter(({ event }) => event === 'request_revision').length, 7);
});

test('allows three QA revisions, then requires a QA pass or an explicit failure', t => {
  const { flow, project, dir } = fixture(t);
  advance(flow, 7);
  for (let i = 1; i <= 3; i += 1) {
    const revised = apply(flow, ['qa_fail', 'system', 'implementing']);
    assert.equal(revised.qaRevisions, i);
    assert.equal(revised.approved, true);
    assert.equal(revised.anchorId, 'v001');
    assert.equal(flow.canImplement(), true);
    apply(flow, ['finish', 'system', 'qa']);
  }
  apply(flow, ['fail', 'system', 'failed', { reason: 'Temporary' }]);
  const reopened = createFlow(project);
  apply(reopened, ['retry', 'manager', 'qa']);
  const before = diskFiles(dir);
  const rejected = reopened.dispatch('qa_fail', { actor: 'system' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /QA revision limit/);
  assert.deepEqual(diskFiles(dir), before);
  apply(reopened, ['qa_pass', 'system', 'final_review']);
  apply(reopened, ['finish', 'manager', 'done']);
});

test('ignores prototype keys and inherited arguments and rejects invalid or mismatched anchor IDs', t => {
  const { flow, dir } = fixture(t);
  assert.equal(flow.dispatch('set_goals', Object.create({ actor: 'manager' })).ok, false);
  const goals = JSON.parse('{"valid":{"copy":true,"constructor":{},"prototype":{}},"__proto__":{"polluted":true}}');
  const result = flow.dispatch('set_goals', { actor: 'manager', goals });
  assert.deepEqual(result.state.goals, { valid: { copy: true } });
  assert.equal({}.polluted, undefined);
  const before = diskFiles(dir);
  for (const event of ['constructor', 'prototype', '__proto__', 'toString', null]) {
    assert.equal(flow.dispatch(event, { actor: 'system' }).ok, false);
  }
  for (const anchorId of ['../v001', '/v001', 'v001\\..', 'v000', 'v001\n', null]) {
    const bad = flow.dispatch('anchor_ready', { actor: 'system', anchorId });
    assert.equal(bad.ok, false);
    assert.match(bad.error, /anchor ID/);
  }
  assert.deepEqual(diskFiles(dir), before);
  apply(flow, MAIN_PATH[1]);
  apply(flow, MAIN_PATH[2]);
  assert.equal(flow.dispatch('approve', { actor: 'manager', anchorId: 'v002' }).ok, false);
  apply(flow, MAIN_PATH[3]);
  assert.equal(flow.dispatch('lock', { actor: 'manager', anchorId: 'v002' }).ok, false);
  apply(flow, MAIN_PATH[4]);
});

test('a process crash between writing and renaming the flow leaves state and log byte-identical', t => {
  const { flow, project, dir, file, log } = fixture(t);
  advance(flow, 1);
  const before = [fs.readFileSync(file), fs.readFileSync(log)];
  const child = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const path = require('node:path');
    const { createFlow } = require(process.argv[1]);
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (path.basename(to) === 'flow.json') {
        const data = JSON.parse(fs.readFileSync(from, 'utf8'));
        process.exit(data.state === 'advisor_review' ? 73 : 74);
      }
      return rename(from, to);
    };
    createFlow(process.argv[2]).dispatch('anchor_ready', { actor: 'system', anchorId: 'v001' });
  `, require.resolve('../lib/anchorflow'), project], { encoding: 'utf8' });
  assert.equal(child.status, 73, child.stderr);
  assert.deepEqual([fs.readFileSync(file), fs.readFileSync(log)], before);
  assert.equal(fs.readdirSync(dir).filter(name => /^\.flow-.*\.tmp$/.test(name)).length, 1);
  const reopened = createFlow(project);
  assert.equal(reopened.state().state, 'generating');
  apply(reopened, MAIN_PATH[1]);
  assert.deepEqual(logs(log).map(({ event }) => event), ['set_goals', 'anchor_ready']);
});

test('reopening completes a partial log append after committing state exactly once', t => {
  const { flow, project, file, log } = fixture(t);
  advance(flow, 1);
  const previousLog = fs.readFileSync(log);
  const child = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const { createFlow } = require(process.argv[1]);
    const write = fs.writeFileSync;
    fs.writeFileSync = (fd, data, options) => {
      if (Buffer.isBuffer(data) && data.includes('anchor_ready')) {
        write(fd, data.subarray(0, 16));
        process.exit(73);
      }
      return write(fd, data, options);
    };
    createFlow(process.argv[2]).dispatch('anchor_ready', { actor: 'system', anchorId: 'v001' });
  `, require.resolve('../lib/anchorflow'), project], { encoding: 'utf8' });
  assert.equal(child.status, 73, child.stderr);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).state, 'advisor_review');
  const partial = fs.readFileSync(log);
  assert.deepEqual(partial.subarray(0, previousLog.length), previousLog);
  assert.equal(partial.length, previousLog.length + 16);

  assert.equal(createFlow(project).state().state, 'advisor_review');
  assert.equal(createFlow(project).state().state, 'advisor_review');
  assert.deepEqual(logs(log).map(({ event }) => event), ['set_goals', 'anchor_ready']);
  apply(flow, MAIN_PATH[2]);
  assert.deepEqual(logs(log).map(({ event }) => event), ['set_goals', 'anchor_ready', 'advisor_pass']);
});

test('rejects a symlinked audit log before persisting a transition', t => {
  const { project, dir, file, log, flow } = fixture(t);
  const outside = path.join(project, 'outside');
  fs.writeFileSync(outside, 'unchanged');
  fs.mkdirSync(dir);
  fs.symlinkSync(outside, log);
  assert.throws(() => flow.dispatch('set_goals', { actor: 'manager' }), /Invalid anchor transition log/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'unchanged');
  assert.equal(fs.existsSync(file), false);
});
