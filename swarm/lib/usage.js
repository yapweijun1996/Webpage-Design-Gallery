'use strict';

const isCount = value => Number.isSafeInteger(value) && value >= 0;

// Standard short-context USD per million text tokens. Cache writes assume 30 minutes.
// https://developers.openai.com/api/docs/models/gpt-6.1-terra
// https://developers.openai.com/api/docs/models/gpt-6.2-sol
const codexRates = new Map([
  ['gpt-6.1-terra', { input: 1, cached: 0.05, cacheWrite: 1.25, output: 5 }],
  ['gpt-6.2-sol', { input: 2, cached: 0.10, cacheWrite: 2.50, output: 10 }],
]);

function createUsage() {
  return {
    tokens: 0, usd: null, reports: 0, unpriced: 0, missingUsage: 0, apiEstimates: 0,
    input: 0, cached: 0, output: 0, breakdownReports: 0,
  };
}

function normalizeUsage(runner, usage, model) {
  if (!usage) return null;
  if (runner === 'pi') {
    if (!isCount(usage.totalTokens)) return null;
    const cost = usage.cost?.total;
    const { input, cacheRead, cacheWrite, output } = usage;
    const breakdown = [input, cacheRead, cacheWrite, output].every(isCount)
      && input + cacheRead + cacheWrite + output === usage.totalTokens
      ? { input: input + cacheWrite, cached: cacheRead, output } : null;
    return {
      tokens: usage.totalTokens,
      usd: Number.isFinite(cost) && cost >= 0 ? cost : null,
      breakdown,
    };
  }
  // Cache reads and writes are subsets of input. Reasoning is a subset of output.
  const { input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: cacheWrite = 0,
    output_tokens: output } = usage;
  if (!isCount(input) || !isCount(output)) return null;
  const breakdown = isCount(cached) && cached <= input ? { input: input - cached, cached, output } : null;
  const rates = runner === 'codex' ? codexRates.get(model) : undefined;
  const usd = rates && breakdown && isCount(cacheWrite) && cacheWrite <= breakdown.input
    ? ((breakdown.input - cacheWrite) * rates.input + cached * rates.cached
      + cacheWrite * rates.cacheWrite + output * rates.output) / 1_000_000
    : null;
  return { tokens: input + output, usd, breakdown, apiEstimate: usd !== null };
}

function addUsage(total, usage) {
  if (!usage) {
    total.missingUsage += 1;
    return;
  }
  total.tokens += usage.tokens;
  total.reports += 1;
  if (usage.breakdown) {
    total.input += usage.breakdown.input;
    total.cached += usage.breakdown.cached;
    total.output += usage.breakdown.output;
    total.breakdownReports += 1;
  }
  if (usage.usd === null) {
    total.unpriced += 1;
  } else {
    total.usd = (total.usd ?? 0) + usage.usd;
    if (usage.apiEstimate) total.apiEstimates += 1;
  }
}

module.exports = { createUsage, normalizeUsage, addUsage };
