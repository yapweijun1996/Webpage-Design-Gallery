'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const lessons = require('../lib/lessons');

const exec = promisify(execFile);

function fixture(t) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-lessons-test-'));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const directory = path.join(projectDir, 'lessons');
  return { projectDir, directory, file: path.join(directory, 'lessons.jsonl'), store: lessons.createLessons(projectDir) };
}

function lesson(fields = {}) {
  return { title: 'Review the layout', text: 'Check at all supported widths.', evidence: ['anchors/log.jsonl#31'], ...fields };
}

test('reads an empty project without creating a store and writes the specified JSONL shape', t => {
  const { projectDir, directory, file, store } = fixture(t);
  assert.deepEqual(store.list(), []);
  assert.deepEqual(store.search('layout'), []);
  assert.equal(store.forPrompt(), '');
  assert.equal(fs.existsSync(directory), false);

  const entry = lessons.add(projectDir, lesson({ title: '  Layout  ', text: 'Check widths.\nCheck spacing. ' }));
  assert.match(entry.id, /^[a-f0-9-]{36}$/);
  assert.equal(new Date(entry.ts).toISOString(), entry.ts);
  assert.deepEqual(entry, {
    id: entry.id, ts: entry.ts, title: 'Layout', text: 'Check widths.\nCheck spacing.',
    evidence: ['anchors/log.jsonl#31'], tags: [], status: 'proposed',
  });
  assert.equal(fs.readFileSync(file, 'utf8'), `${JSON.stringify(entry)}\n`);
  assert.deepEqual(lessons.list(projectDir), [entry]);
});

test('requires non-empty evidence and non-empty title and text before creating a log', t => {
  const { directory, store } = fixture(t);
  for (const evidence of [undefined, null, 'reference', [], [' '], ['reference', null], Array(1)]) {
    assert.throws(() => store.add(lesson({ evidence })), /evidence/i);
  }
  assert.throws(() => store.add(lesson({ title: '' })), /title/i);
  assert.throws(() => store.add(lesson({ text: ' \n\t ' })), /text/i);
  assert.equal(fs.existsSync(directory), false);
});

test('refuses secret-looking keys, bearer tokens, long hex and passwords without echoing them', t => {
  const { directory, store } = fixture(t);
  const key = 'sk-' + 'example-only-1234';
  const bearer = 'Bearer ' + 'test.value-1234';
  const hex = '0123abcd'.repeat(4);
  const password = 'DB_PASSWORD' + ' = "fictional"';
  for (const [value, fields] of [
    [key, { title: key }],
    [bearer, { text: `Authorization: ${bearer}` }],
    [hex, { evidence: [`log/ref_${hex}`] }],
    [password, { text: password }],
    [key, { tags: [key] }],
  ]) {
    assert.throws(() => store.add(lesson(fields)), error => (
      /secret-looking/i.test(error.message) && !error.message.includes(value)
    ));
  }
  assert.equal(fs.existsSync(directory), false);
});

test('validates tags on writes and prompt reads and rejects unsupported statuses', t => {
  const { store } = fixture(t);
  for (const tags of [null, 'layout', [''], ['Layout'], ['../layout'], ['layout\n'], ['ui design'], [42], Array(1)]) {
    assert.throws(() => store.add(lesson({ tags })), /tags/i);
    assert.throws(() => store.forPrompt({ tags }), /tags/i);
  }
  assert.throws(() => store.add(lesson({ status: 'approved' })), /status/i);
  const entry = store.add(lesson({ tags: ['ui-design', 'layout', 'ui-design', 'v11'], status: 'verified' }));
  assert.deepEqual(entry.tags, ['ui-design', 'layout', 'v11']);
  assert.equal(entry.status, 'verified');
  assert.deepEqual(store.list(), [entry]);
});

test('appends a new identity and preserves a verified record byte for byte', t => {
  const { file, store } = fixture(t);
  const original = store.add(lesson({ status: 'verified' }));
  const before = fs.readFileSync(file);
  const next = store.add({ ...original, text: 'Check the component spacing.', status: 'proposed' });
  assert.notEqual(next.id, original.id);
  assert.deepEqual(store.list(), [original, next]);
  assert.deepEqual(fs.readFileSync(file).subarray(0, before.length), before);
  next.evidence.push('modified in memory');
  assert.deepEqual(store.list()[1].evidence, original.evidence);
});

test('keeps the supersedes chain and uses only current verified lessons in prompts', t => {
  const { file, store } = fixture(t);
  const original = store.add(lesson({ title: 'Original directions', status: 'verified', tags: ['layout'] }));
  const proposal = store.add(lesson({ title: 'Draft revision', supersedes: original.id, tags: ['layout'] }));
  assert.match(store.forPrompt({ tags: ['layout'] }), /Original directions/);
  assert.doesNotMatch(store.forPrompt(), /Draft revision/);
  const correction = store.add(lesson({
    title: 'Final directions', supersedes: proposal.id, status: 'verified', tags: ['visual-review'],
  }));

  assert.deepEqual(store.list(), [original, proposal, correction]);
  assert.equal(store.list()[2].supersedes, proposal.id);
  assert.equal(store.list()[1].supersedes, original.id);
  assert.equal(store.forPrompt(), '- Final directions: Check at all supported widths.');
  assert.equal(store.forPrompt({ tags: ['layout'] }), '');
  const before = fs.readFileSync(file);
  assert.throws(() => store.add(lesson({ supersedes: 'missing-id' })), /supersedes/i);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('ranks title, tag and body matches with newest entries first on ties', t => {
  const { store } = fixture(t);
  const olderTitle = store.add(lesson({ title: 'Grid QA' }));
  const newerTitle = store.add(lesson({ title: 'Grid tests' }));
  const tag = store.add(lesson({ title: 'Visual inspection', tags: ['grid'] }));
  const body = store.add(lesson({ title: 'Acceptance', text: 'Check the grid grid grid at every step.' }));
  const evidenceOnly = store.add(lesson({ title: 'Release', evidence: ['reports/grid.md'] }));
  assert.deepEqual(store.search('gRiD'), [newerTitle, olderTitle, tag, body]);
  assert.deepEqual(store.search(['grid', 'qa', 'GRID']), [olderTitle, newerTitle, tag, body]);
  assert.deepEqual(store.search('missing'), []);
  assert.deepEqual(store.search('  '), [evidenceOnly, body, tag, newerTitle, olderTitle]);
});

test('keeps whole verified prompt entries within the exact budget including separators', t => {
  const { projectDir, store } = fixture(t);
  store.add(lesson({ title: 'QA', text: 'Grid.', status: 'verified', tags: ['layout'] }));
  store.add(lesson({ title: 'Type', text: 'Check café.', status: 'verified', tags: ['layout', 'typography'] }));
  store.add(lesson({ title: 'Long', text: 'Long directions. '.repeat(60), status: 'verified', tags: ['layout'] }));
  store.add(lesson({ title: 'Draft', text: 'Check.', tags: ['layout'] }));
  const first = '- Type: Check café.';
  const second = '- QA: Grid.';
  const both = `${first}\n${second}`;
  assert.equal(lessons.forPrompt(projectDir, { tags: ['layout'], budget: 0 }), '');
  assert.equal(store.forPrompt({ tags: ['layout'], budget: second.length }), second);
  assert.equal(store.forPrompt({ tags: ['layout'], budget: both.length - 1 }), first);
  assert.equal(store.forPrompt({ tags: ['layout'], budget: both.length }), both);
  assert.equal(store.forPrompt({ tags: ['typography', 'missing'], budget: both.length }), first);
  assert.throws(() => store.forPrompt({ budget: -1 }), /budget/i);
});

test('keeps the previous log intact after an interrupted append and allows a retry', t => {
  const { directory, file, store } = fixture(t);
  const original = store.add(lesson({ status: 'verified' }));
  const before = fs.readFileSync(file);
  const write = fs.writeFileSync;
  let writes = 0;
  const mock = t.mock.method(fs, 'writeFileSync', (target, data) => {
    if (++writes === 2) {
      write(target, data.subarray(0, 8));
      assert.deepEqual(fs.readFileSync(file), before);
      throw new Error('Injected partial write');
    }
    return write(target, data);
  });
  try {
    assert.throws(() => store.add(lesson({ title: 'New entry' })), /Injected partial write/);
  } finally {
    mock.mock.restore();
  }

  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(fs.readdirSync(directory), ['lessons.jsonl']);
  const retry = store.add(lesson({ title: 'New entry' }));
  assert.deepEqual(store.list(), [original, retry]);
});

test('skips corrupt lines and duplicate IDs and can append after an incomplete tail', t => {
  const { file, store } = fixture(t);
  const first = store.add(lesson({ status: 'verified' }));
  fs.appendFileSync(file, `\nnot json\nnull\n{"id":"bad"}\n${JSON.stringify({ ...first, text: 'Forged edit.' })}\n`);
  const second = store.add(lesson({ title: 'Second entry' }));
  fs.appendFileSync(file, Buffer.concat([Buffer.from('{"id":"'), Buffer.from([0xff])]));
  const before = fs.readFileSync(file);
  assert.deepEqual(store.list(), [first, second]);
  const third = store.add(lesson({ title: 'Third entry' }));
  assert.deepEqual(store.list(), [first, second, third]);
  assert.deepEqual(fs.readFileSync(file).subarray(0, before.length), before);
});

test('preserves every append made by concurrent processes', async t => {
  const { projectDir, directory, file, store } = fixture(t);
  const worker = `
    const [modulePath, projectDir, workerId] = process.argv.slice(1);
    const store = require(modulePath).createLessons(projectDir);
    for (let index = 0; index < 12; index++) {
      store.add({ title: workerId + '-' + index, text: 'Check concurrency.', evidence: ['worker output'] });
    }
  `;
  await Promise.all(Array.from({ length: 6 }, (_, id) => exec(process.execPath, [
    '-e', worker, require.resolve('../lib/lessons'), projectDir, `worker-${id}`,
  ], { timeout: 10_000 })));

  const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  const titles = Array.from({ length: 6 }, (_, id) => Array.from({ length: 12 }, (_, index) => `worker-${id}-${index}`)).flat();
  assert.equal(rows.length, 72);
  assert.equal(new Set(rows.map(row => row.id)).size, 72);
  assert.deepEqual(rows.map(row => row.title).sort(), titles.sort());
  assert.deepEqual(store.list(), rows);
  assert.deepEqual(fs.readdirSync(directory), ['lessons.jsonl']);
});
