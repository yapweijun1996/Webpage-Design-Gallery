'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const REVISION_LIMIT = 3;
const IMPLEMENTATION_STATES = new Set(['locked', 'implementing', 'qa', 'final_review', 'done']);
const ANCHOR_ID = /^v(?:00[1-9]|0[1-9]\d|[1-9]\d{2,})$/;
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// The system finishes implementation; the Manager finishes final review.
const ROUTES = new Map(Object.entries({
  goals: { set_goals: ['generating', 'manager'] },
  generating: { anchor_ready: ['advisor_review', 'system'] },
  advisor_review: {
    advisor_pass: ['awaiting_approval', 'advisor'],
    advisor_revise: ['generating', 'advisor'],
  },
  awaiting_approval: {
    approve: ['awaiting_approval', 'manager'],
    request_revision: ['generating', 'manager'],
    lock: ['locked', 'manager'],
  },
  locked: {
    start_implementation: ['implementing', 'system'],
    unlock: ['generating', 'manager'],
  },
  implementing: { finish: ['qa', 'system'] },
  qa: {
    qa_pass: ['final_review', 'system'],
    qa_fail: ['implementing', 'system'],
  },
  final_review: { finish: ['done', 'manager'] },
  done: {},
  failed: { retry: [null, 'manager'] },
}));

function own(object, key) {
  return object != null && Object.hasOwn(object, key) ? object[key] : undefined;
}

function parseJSON(text) {
  return JSON.parse(text, (key, value) => PROTOTYPE_KEYS.has(key) ? undefined : value);
}

function initialState() {
  return {
    state: 'goals',
    goals: null,
    anchorId: null,
    approved: false,
    advisorRevisions: 0,
    qaRevisions: 0,
    failure: null,
  };
}

function transition(previous, event, payload) {
  const reject = error => ({ ok: false, state: previous, error });
  const actor = own(payload, 'actor');
  const reason = own(payload, 'reason');
  const anchorId = own(payload, 'anchorId');
  if (typeof event !== 'string') return reject('Invalid anchor event');
  if (anchorId !== undefined && (typeof anchorId !== 'string' || !ANCHOR_ID.test(anchorId))) {
    return reject('Invalid anchor ID');
  }

  if (event === 'fail') {
    if (actor !== 'manager' && actor !== 'system') return reject('Manager or system actor required');
    if (typeof reason !== 'string' || !reason.trim()) return reject('A failure reason is required');
    const from = previous.failure?.from ?? previous.state;
    return { ok: true, state: { ...previous, state: 'failed', failure: { from, reason } } };
  }

  const route = own(ROUTES.get(previous.state), event);
  if (!route) return reject(`Event ${event} is illegal from ${previous.state}`);
  const [target, expectedActor] = route;
  if (actor !== expectedActor) return reject(`The ${expectedActor} actor is required for ${event}`);
  if (event !== 'anchor_ready' && anchorId !== undefined && previous.anchorId !== anchorId) {
    return reject('Event refers to a different anchor');
  }

  const next = { ...previous, state: target };
  switch (event) {
    case 'set_goals':
      try {
        next.goals = parseJSON(JSON.stringify(own(payload, 'goals') ?? null));
      } catch {
        return reject('Goals must be JSON data');
      }
      break;
    case 'anchor_ready':
      next.anchorId = anchorId ?? null;
      break;
    case 'approve':
      if (previous.approved) return reject('This anchor is already approved');
      next.approved = true;
      break;
    case 'lock':
      if (!previous.approved) return reject('Manager approval is required before locking');
      break;
    case 'advisor_revise':
      if (previous.advisorRevisions >= REVISION_LIMIT) return reject('Advisor revision limit reached');
      next.advisorRevisions += 1;
      break;
    case 'qa_fail':
      if (previous.qaRevisions >= REVISION_LIMIT) return reject('QA revision limit reached');
      next.qaRevisions += 1;
      break;
    case 'retry':
      next.state = previous.failure.from;
      next.failure = null;
      break;
  }
  if (target === 'generating') {
    next.anchorId = null;
    next.approved = false;
  }
  return { ok: true, state: next };
}

function syncDirectory(dir) {
  const fd = fs.openSync(dir, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function writeState(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temporary = path.join(dir, `.flow-${randomUUID()}.tmp`);
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, file);
    syncDirectory(dir);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function createFlow(projectDir) {
  const dir = path.join(projectDir, 'anchors');
  const file = path.join(dir, 'flow.json');
  const log = path.join(dir, 'log.jsonl');

  function load() {
    const root = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (root && !root.isDirectory()) throw new Error('Invalid anchor directory');
    const entry = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!entry) return { snapshot: initialState(), lastTransition: null };
    if (!entry.isFile()) throw new Error('Invalid anchor flow file');
    const { lastTransition, ...snapshot } = parseJSON(fs.readFileSync(file, 'utf8'));
    if (!ROUTES.has(snapshot.state)) throw new Error('Invalid anchor flow state');
    return { snapshot, lastTransition };
  }

  // flow.json commits the state and the next log entry in a single atomic rename.
  // Reopening replays a missing entry or completes a partial append at its saved offset.
  function syncLog(commit) {
    const entry = fs.lstatSync(log, { throwIfNoEntry: false });
    if (entry && !entry.isFile()) throw new Error('Invalid anchor transition log');
    if (!commit) {
      if (entry?.size) throw new Error('Anchor transition log has no flow checkpoint');
      return 0;
    }

    const { offset, line } = commit;
    const encoded = Buffer.from(JSON.stringify(line) + '\n', 'utf8');
    const end = offset + encoded.length;
    const fd = fs.openSync(log, fs.constants.O_RDWR | fs.constants.O_APPEND
      | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, 0o600);
    try {
      const length = fs.fstatSync(fd).size - offset;
      if (length < 0 || length > encoded.length) throw new Error('Anchor transition log does not match the flow checkpoint');
      const prefix = Buffer.alloc(length);
      if (fs.readSync(fd, prefix, 0, length, offset) !== length || !prefix.equals(encoded.subarray(0, length))) {
        throw new Error('Anchor transition log does not match the flow checkpoint');
      }
      if (length < encoded.length) {
        fs.writeFileSync(fd, encoded.subarray(length));
        fs.fsyncSync(fd);
      }
    } finally {
      fs.closeSync(fd);
    }
    if (!entry) syncDirectory(dir);
    return end;
  }

  const { lastTransition } = load();
  if (lastTransition) syncLog(lastTransition);

  function state() {
    return load().snapshot;
  }

  function dispatch(event, payload) {
    const { snapshot, lastTransition } = load();
    const result = transition(snapshot, event, payload);
    if (!result.ok) return result;

    const offset = syncLog(lastTransition);
    const line = {
      ts: new Date().toISOString(),
      from: snapshot.state,
      to: result.state.state,
      event,
      actor: own(payload, 'actor'),
    };
    const commit = { offset, line };
    writeState(file, { ...result.state, lastTransition: commit });
    syncLog(commit);
    return result;
  }

  function canImplement() {
    return IMPLEMENTATION_STATES.has(state().state);
  }

  return { state, dispatch, canImplement };
}

module.exports = { createFlow };
