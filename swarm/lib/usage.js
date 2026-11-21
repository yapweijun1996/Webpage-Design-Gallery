'use strict';

const isCount = value => Number.isSafeInteger(value) && value >= 0;

function createUsage() {
  return {
    tokens: 0, usd: null, reports: 0, unpriced: 0, missingUsage: 0,
    input: 0, cached: 0, output: 0, breakdownReports: 0,
  };
}

function normalizeUsage(runner, usage) {
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
  // Codex input and output totals already include cached and reasoning tokens.
  const { input_tokens: input, cached_input_tokens: cached, output_tokens: output } = usage;
  if (!isCount(input) || !isCount(output)) return null;
  const breakdown = isCount(cached) && cached <= input ? { input: input - cached, cached, output } : null;
  return { tokens: input + output, usd: null, breakdown };
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
  }
}

module.exports = { createUsage, normalizeUsage, addUsage };
