'use strict';
// Exercise the actual page handlers with local DOM doubles; no browser or network is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element(value) {
  return {value, checked: false, disabled: true, hidden: true, textContent: '', dataset: {}, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    change() { this.listeners.change(); }, click() { this.listeners.click(); }, focus() { this.focused = true; }};
}
const prices = ['3990', '3200', '4800'];
const product = element(prices[0]), quantity = element('1'), total = element(), breakdown = element();
Object.defineProperty(product, 'selectedIndex', {set(index) { this.value = prices[index]; }});
const choices = prices.map((_, i) => { const el = element(); el.dataset.estimateChoice = String(i); return el; });
const checks = [element(), element()], collected = element(), statuses = [element(), element()];
const progress = [element(), element()], announcement = element();
const estimator = {querySelector: selector => ({'[data-estimate-product]': product, '[data-estimate-quantity]': quantity,
  '[data-estimate-total]': total, '[data-estimate-breakdown]': breakdown})[selector]};
const order = {dataset: {preparing: 'Preparing', ready: 'Ready', collected: 'Collected', progressLabel: 'Checks completed'},
  querySelectorAll: selector => ({'[data-prep-check]': checks, '[data-pickup-status]': statuses, '[data-prep-progress]': progress})[selector],
  querySelector: selector => selector === '[data-pickup-collected]' ? collected : selector === '[data-pickup-announcement]' ? announcement : null};
const document = {documentElement: {dataset: {}, classList: {remove() {}}}, querySelector() { return null; },
  querySelectorAll(selector) { return ({'[data-estimator]': [estimator], '[data-pickup-example]': [order], '[data-estimate-choice]': choices})[selector] || []; }, addEventListener() {}};
vm.runInNewContext(fs.readFileSync('demos/corporate/pomelo-stem/v7/assets/app.js', 'utf8'), {document, window: {addEventListener() {}}, console});
for (const [i, count, expected, formula] of [[0, '2', 'RM 79.80', 'RM 39.90 × 2'], [1, '3', 'RM 96.00', 'RM 32.00 × 3'], [2, '6', 'RM 288.00', 'RM 48.00 × 6']]) {
  quantity.value = count; choices[i].click();
  assert.equal(choices[i].hidden, false); assert.equal(product.focused, true);
  assert.equal(total.textContent, expected); assert.equal(breakdown.textContent, formula);
}
checks[1].checked = true; checks[1].change();
assert.deepEqual(progress.map(x => x.textContent), ['1 / 2', '1 / 2']);
assert.deepEqual(statuses.map(x => x.textContent), ['Preparing', 'Preparing']);
checks[0].checked = true; checks[0].change();
assert.deepEqual(progress.map(x => x.textContent), ['2 / 2', '2 / 2']);
assert.equal(collected.disabled, false); assert.equal(announcement.textContent, 'Ready · Checks completed: 2 / 2');
collected.checked = true; collected.change(); assert.equal(announcement.textContent, 'Collected · Checks completed: 2 / 2');
checks[1].checked = false; checks[1].change();
assert.equal(collected.checked, false); assert.equal(collected.disabled, true);
assert.equal(announcement.textContent, 'Preparing · Checks completed: 1 / 2');
assert.deepEqual(progress.map(x => x.textContent), ['1 / 2', '1 / 2']);
console.log('Pomelo V7.14 interaction checks passed');
