'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ALLOWLIST } = require('../lib/settings');
const team = require('../lib/team');

function worker(changes = {}) {
  return {
    id: '02', name: 'Agent 2', title: 'Hero Designer', section: 'hero',
    lane: 'Own the hero section.', color: '#f76b15', ...changes,
  };
}

function validate(agents, options) {
  return team.validate(agents, { allowlist: ALLOWLIST, ...options });
}

function invalidPaths(result, paths) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(error => error.path), paths);
  assert.ok(result.errors.every(error => typeof error.message === 'string' && error.message.length > 0));
}

test('exports the limits and accepts a valid roster at the ID endpoints', () => {
  assert.deepEqual(team.LIMITS, { maxWorkers: 16, name: 40, title: 60, lane: 400 });
  const agents = [
    worker({ id: '01', position: 'hero-designer' }),
    worker({ id: '99', name: 'Agent 99', title: 'A custom job title', section: 'summary', color: '#FFAA33' }),
  ];
  const result = validate(agents);
  assert.deepEqual(result, { ok: true, errors: [], value: agents });
  assert.notStrictEqual(result.value, agents);
  assert.notStrictEqual(result.value[0], agents[0]);
});

test('rejects a non-array roster and malformed worker entries', () => {
  for (const input of [null, {}, 'agents', 3]) invalidPaths(validate(input), ['agents']);
  invalidPaths(validate([worker(), null, [], 'worker', , 2]), [
    'agents[1]', 'agents[2]', 'agents[3]', 'agents[4]', 'agents[5]',
  ]);
});

test('accepts 1 and 16 workers and rejects 0 and 17 workers', () => {
  const agents = Array.from({ length: 17 }, (_, index) => worker({
    id: String(index + 1).padStart(2, '0'), section: `section-${index + 1}`,
  }));
  assert.equal(validate(agents.slice(0, 1)).ok, true);
  assert.equal(validate(agents.slice(0, 16)).ok, true);
  invalidPaths(validate([]), ['agents']);
  invalidPaths(validate(agents), ['agents']);
});

for (const [field, limit] of [['name', 40], ['title', 60], ['lane', 400]]) {
  test(`enforces the 1 to ${limit} character limit for ${field}`, () => {
    for (const value of ['a', 'a'.repeat(limit)]) {
      const result = validate([worker({ [field]: value })]);
      assert.equal(result.ok, true);
      assert.equal(result.value[0][field], value);
    }
    for (const value of ['', 'a'.repeat(limit + 1), 5]) {
      invalidPaths(validate([worker({ [field]: value })]), [`agents[0].${field}`]);
    }
    const incomplete = worker();
    delete incomplete[field];
    invalidPaths(validate([incomplete]), [`agents[0].${field}`]);
  });
}

test('rejects malformed IDs and the manager ID without coercion', () => {
  for (const id of ['00', '1', '100', 'ab', '01\n', 1]) {
    invalidPaths(validate([worker({ id })]), ['agents[0].id']);
  }
});

test('rejects duplicate IDs and sections on the later worker', () => {
  const result = validate([worker(), worker({ name: 'Another worker' })]);
  invalidPaths(result, ['agents[1].id', 'agents[1].section']);
  assert.ok(result.errors.every(error => /duplicate/i.test(error.message)));
});

test('enforces the section format and its 2 and 25 character boundaries', () => {
  for (const section of ['a0', `a${'-1'.repeat(12)}`]) {
    assert.equal(validate([worker({ section })]).ok, true);
  }
  for (const section of ['Hero', 'hero section', 'a'.repeat(26), 'a', '1hero', 'hero_', 'he\nro']) {
    invalidPaths(validate([worker({ section })]), ['agents[0].section']);
  }
});

test('rejects colours outside the six-digit hex format', () => {
  for (const color of ['#123', '#11223344', 'ffffff', '#abzc12', '#abcdef\n', 112233]) {
    invalidPaths(validate([worker({ color })]), ['agents[0].color']);
  }
});

test('strips C0 and C1 controls from free text before checking lengths', () => {
  const name = 'x'.repeat(40);
  const raw = worker({ name: `\x00${name}\x9f`, title: 'Hero\t Designer\x7f', lane: 'Own\x1b the\n hero\x85.' });
  assert.deepEqual(validate([raw]), {
    ok: true, errors: [], value: [worker({ name, title: 'Hero Designer', lane: 'Own the hero.' })],
  });
  assert.equal(raw.title, 'Hero\t Designer\x7f');
  invalidPaths(validate([worker({ title: '\x00\n\x9f' })]), ['agents[0].title']);
});

test('drops unknown and prototype keys and ignores inherited overrides', () => {
  const raw = JSON.parse('{"extra":true,"__proto__":{"teamPolluted":true},"constructor":{"prototype":{"teamPolluted":true}}}');
  Object.assign(raw, worker());
  Object.setPrototypeOf(raw, { runner: 'omp' });
  const result = validate([raw]);
  assert.deepEqual(result, { ok: true, errors: [], value: [worker()] });
  assert.equal(Object.hasOwn(result.value[0], '__proto__'), false);
  assert.equal(Object.hasOwn(result.value[0], 'constructor'), false);
  assert.equal(Object.getPrototypeOf(result.value[0]), Object.prototype);
  assert.equal(Object.prototype.teamPolluted, undefined);
});

test('accepts every supported runner, model and effort combination', () => {
  for (const runner of ['codex', 'pi']) {
    for (const model of ['gpt-6.2-sol', 'gpt-6.1-terra']) {
      for (const effort of ['medium', 'xhigh']) {
        const agent = worker({ runner, model, effort });
        assert.deepEqual(validate([agent]), { ok: true, errors: [], value: [agent] });
      }
    }
  }
});

test('rejects unsupported overrides at their exact worker field paths', () => {
  const result = validate([
    worker(),
    worker({ id: '03', section: 'footer', runner: 'omp', model: 'unknown-model', effort: 'low' }),
  ]);
  invalidPaths(result, ['agents[1].runner', 'agents[1].model', 'agents[1].effort']);
  invalidPaths(validate([worker({ runner: '__proto__', model: 'constructor', effort: null })]), [
    'agents[0].runner', 'agents[0].model', 'agents[0].effort',
  ]);
});

test('uses the supplied allowlist for all overrides', () => {
  const allowlist = { runners: { custom: 'Custom' }, models: { example: 'Example' }, efforts: ['standard'] };
  const agent = worker({ runner: 'custom', model: 'example', effort: 'standard' });
  assert.deepEqual(validate([agent], { allowlist }), { ok: true, errors: [], value: [agent] });
  invalidPaths(validate([worker({ runner: 'pi', model: 'gpt-6.2-sol', effort: 'medium' })], { allowlist }), [
    'agents[0].runner', 'agents[0].model', 'agents[0].effort',
  ]);
});

test('allows partial overrides without writing inherited defaults', () => {
  for (const override of [{ runner: 'pi' }, { model: 'gpt-6.1-terra' }, { effort: 'xhigh' }]) {
    const agent = worker(override);
    assert.deepEqual(validate([agent]), { ok: true, errors: [], value: [agent] });
  }
  invalidPaths(validate([worker({ runner: undefined })]), ['agents[0].runner']);
});

test('rejects positions that do not identify a staff role', () => {
  for (const position of ['Hero Designer', 'unknown-position', 'constructor', 2]) {
    invalidPaths(validate([worker({ position })]), ['agents[0].position']);
  }
});

test('rejects an existing worker section change and allows other edits', () => {
  const existing = [worker()];
  const result = validate([worker({ section: 'intro' })], { existing });
  invalidPaths(result, ['agents[0].section']);
  assert.match(result.errors[0].message, /cannot change the section of existing worker 02/i);
  const updated = worker({ title: 'Lead Designer' });
  const added = worker({ id: '03', section: 'intro' });
  assert.deepEqual(validate([added, updated], { existing }), { ok: true, errors: [], value: [added, updated] });
});

test('allocates the next ID above the maximum without filling gaps', () => {
  assert.equal(team.nextId([]), '01');
  assert.equal(team.nextId([{ id: '04' }, { id: '10' }, { id: '01' }]), '11');
  assert.equal(team.nextId([{ id: '98' }]), '99');
  assert.throws(() => team.nextId([{ id: '01' }, { id: '99' }]), /no worker ids.*99/i);
});

test('diff reports added and removed workers and the changed fields by ID', () => {
  const retained = worker({ runner: 'pi', effort: 'medium', position: 'hero-designer' });
  const removed = worker({ id: '03', section: 'intro' });
  const added = worker({ id: '04', section: 'contact' });
  const unchanged = worker({ id: '05', section: 'footer' });
  const edited = worker({
    name: 'Hero lead', title: 'Lead Designer', section: 'hero-area', lane: 'Own the opening.',
    color: '#112233', model: 'gpt-6.1-terra', effort: 'xhigh',
  });
  assert.deepEqual(team.diff([retained, removed, unchanged], [added, { ...unchanged }, edited]), {
    added: [added], removed: [removed],
    changed: [{ id: '02', fields: ['name', 'title', 'section', 'lane', 'color', 'runner', 'model', 'effort', 'position'] }],
  });
});

test('diff output is independent of input ordering', () => {
  const oldAgents = ['01', '03', '05', '07'].map(id => worker({ id }));
  const newAgents = ['08', '06', '05', '01'].map(id => worker({ id, title: 'Edited' }));
  const result = team.diff(oldAgents, newAgents);
  assert.deepEqual(result.added.map(agent => agent.id), ['06', '08']);
  assert.deepEqual(result.removed.map(agent => agent.id), ['03', '07']);
  assert.deepEqual(result.changed, [{ id: '01', fields: ['title'] }, { id: '05', fields: ['title'] }]);
  assert.deepEqual(team.diff(oldAgents.toReversed(), newAgents.toReversed()), result);
  assert.deepEqual(team.diff(oldAgents, oldAgents.toReversed()), { added: [], removed: [], changed: [] });
});

function luminance(hex) {
  const linear = hex.slice(1).match(/../g).map(channel => {
    const sRGB = Number.parseInt(channel, 16) / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

test('palette is deterministic, wraps and provides distinct accessible colours', () => {
  const colours = Array.from({ length: 16 }, (_, index) => team.palette(index));
  assert.equal(new Set(colours).size, 16);
  for (const [index, color] of colours.entries()) {
    assert.match(color, /^#[0-9a-f]{6}$/);
    assert.equal(team.palette(index), color);
    assert.equal(team.palette(colours.length + index), color);
    for (const surface of ['#13161c', '#171a21', '#262b36']) {
      assert.ok((luminance(color) + 0.05) / (luminance(surface) + 0.05) >= 4.5, `${color} against ${surface}`);
    }
  }
});

test('view preserves roster order and returns unique sorted position titles', () => {
  const agents = [worker({ id: '04' }), worker({ title: 'Custom title' })];
  const positions = [
    { title: 'Writer', mission: 'Write copy' }, { title: 'Designer' },
    { title: 'Writer' }, { title: 'Accessibility Reviewer' }, { title: '' }, {},
  ];
  assert.deepEqual(team.view(agents, positions), {
    agents, titles: ['Accessibility Reviewer', 'Designer', 'Writer'],
  });
  assert.deepEqual(team.view(agents, []), { agents, titles: [] });
});
