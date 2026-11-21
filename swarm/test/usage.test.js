'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createUsage, normalizeUsage, addUsage } = require('../lib/usage');

test('pi includes cache writes in input while retaining reported USD', () => {
  const usage = normalizeUsage('pi', {
    input: 20, cacheRead: 40, cacheWrite: 10, output: 8, totalTokens: 78,
    cost: { total: 0.001 },
  });
  assert.deepEqual(usage, {
    tokens: 78, usd: 0.001, breakdown: { input: 30, cached: 40, output: 8 },
  });
});

test('totals retain reports with unavailable or inconsistent breakdowns', () => {
  const total = createUsage();
  addUsage(total, normalizeUsage('codex', { input_tokens: 30, output_tokens: 5 }));
  addUsage(total, normalizeUsage('codex', {
    input_tokens: 100, cached_input_tokens: 20, output_tokens: 25, reasoning_output_tokens: 5,
  }));
  addUsage(total, normalizeUsage('pi', { totalTokens: 40, cost: { total: 0.001 } }));
  addUsage(total, null);
  assert.deepEqual(total, {
    tokens: 200, usd: 0.001, reports: 3, unpriced: 2, missingUsage: 1,
    input: 80, cached: 20, output: 25, breakdownReports: 1,
  });
});
