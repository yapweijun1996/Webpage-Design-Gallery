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

test('Codex estimates at the selected model rate without double-counting caches or reasoning', () => {
  const tokens = {
    input_tokens: 100, cached_input_tokens: 40, cache_write_input_tokens: 20,
    output_tokens: 10, reasoning_output_tokens: 5,
  };
  const terra = normalizeUsage('codex', tokens, 'gpt-6.1-terra');
  assert.deepEqual(terra, {
    tokens: 110, usd: 0.000117, breakdown: { input: 60, cached: 40, output: 10 }, apiEstimate: true,
  });
  assert.equal(normalizeUsage('codex', tokens, 'gpt-6.2-sol').usd, 0.000234);
  assert.equal(normalizeUsage('codex', tokens, 'unknown-model').usd, null);
  assert.equal(normalizeUsage('codex', { ...tokens, cache_write_input_tokens: 61 }, 'gpt-6.1-terra').usd, null);
  assert.equal(normalizeUsage('codex', { ...tokens, cached_input_tokens: undefined }, 'gpt-6.1-terra').usd, null);
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
    tokens: 200, usd: 0.001, reports: 3, unpriced: 2, missingUsage: 1, apiEstimates: 0,
    input: 80, cached: 20, output: 25, breakdownReports: 1,
  });
});
