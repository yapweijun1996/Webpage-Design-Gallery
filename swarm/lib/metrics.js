'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const STAGES = ['route', 'compose', 'build', 'render', 'modelTime'];
const activeSpans = [];
const isDuration = value => Number.isFinite(value) && value >= 0;

function span(name) {
  const started = performance.now();
  let elapsed;
  const timer = {
    name,
    end() {
      if (elapsed === undefined) {
        elapsed = performance.now() - started;
        activeSpans.splice(activeSpans.indexOf(timer), 1);
      }
      return elapsed;
    },
  };
  activeSpans.push(timer);
  return timer;
}

function end() {
  return activeSpans.at(-1)?.end() ?? null;
}

function record(runId, measurements, projectDir = path.join(__dirname, '../projects', process.env.SWARM_PROJECT || 'home')) {
  if (!isDuration(measurements?.total)) throw new TypeError('A non-negative total duration is required');
  const row = { runId, total: measurements.total };
  for (const field of [...STAGES, 'cacheHits']) {
    if (measurements[field] !== undefined) row[field] = measurements[field];
  }
  const directory = path.join(projectDir, '.run');
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(path.join(directory, 'metrics.jsonl'), `${JSON.stringify(row)}\n`);
}

function statistics(values) {
  const n = values.length;
  values.sort((a, b) => a - b);
  // Nearest rank reports observed samples, including for small runs.
  return {
    n,
    p50: values[Math.ceil(n * 0.50) - 1] ?? null,
    p95: values[Math.ceil(n * 0.95) - 1] ?? null,
    max: values.at(-1) ?? null,
  };
}

function summarize(file) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    content = '';
  }

  const totals = [];
  const samples = Object.fromEntries(STAGES.map(stage => [stage, []]));
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      // A reader can encounter a partially written row.
      continue;
    }
    if (!isDuration(row?.total)) continue;
    totals.push(row.total);
    for (const stage of STAGES) {
      if (isDuration(row[stage])) samples[stage].push(row[stage]);
    }
  }

  const byStage = Object.fromEntries(Object.entries(samples)
    .filter(([, values]) => values.length)
    .map(([stage, values]) => [stage, statistics(values)]));
  return { ...statistics(totals), byStage };
}

module.exports = { span, end, record, summarize };
