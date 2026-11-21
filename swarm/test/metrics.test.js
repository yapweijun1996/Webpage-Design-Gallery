'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { span, end, record, summarize } = require('../lib/metrics');

function fixture(t) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-metrics-test-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  return { project, file: path.join(project, '.run', 'metrics.jsonl') };
}

test('named spans time overlapping work and can end only once', () => {
  const outer = span('total');
  const inner = span('build');
  assert.equal(outer.name, 'total');
  assert.equal(inner.name, 'build');
  const result = end();
  assert.ok(Number.isFinite(result) && result >= 0);
  assert.equal(inner.end(), result);
  assert.ok(outer.end() >= result);
  assert.equal(end(), null);
});

test('record creates the project metrics log and appends one flat JSON object per run', t => {
  const { project, file } = fixture(t);
  const values = { total: 18, route: 0, compose: 3, build: 8, render: 6, modelTime: 0, cacheHits: 2 };
  record('a', values, project);
  record('b', { total: 25, render: null }, project);
  const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(rows, [{ runId: 'a', ...values }, { runId: 'b', total: 25, render: null }]);
});

test('summarize reports nearest-rank percentiles and counts measured stages independently', t => {
  const { project, file } = fixture(t);
  for (let total = 20; total > 0; total--) {
    record(total, { total, route: total / 10, build: total <= 2 ? total * 2 : null, cacheHits: 1 }, project);
  }
  fs.appendFileSync(file, '\n{"total":-1,"build":1}\n{"total":');
  assert.deepEqual(summarize(file), {
    n: 20, p50: 10, p95: 19, max: 20,
    byStage: { route: { n: 20, p50: 1, p95: 1.9, max: 2 }, build: { n: 2, p50: 2, p95: 4, max: 4 } },
  });
});

test('summarize describes missing and empty metrics logs without inventing measurements', t => {
  const { project, file } = fixture(t);
  const empty = { n: 0, p50: null, p95: null, max: null, byStage: {} };
  assert.deepEqual(summarize(file), empty);
  fs.mkdirSync(path.join(project, '.run'));
  fs.writeFileSync(file, '\n');
  assert.deepEqual(summarize(file), empty);
});

test('record rejects an invalid total before creating a log', t => {
  const { project, file } = fixture(t);
  assert.throws(() => record('invalid', { total: Infinity }, project), /total duration/);
  assert.equal(fs.existsSync(file), false);
});
