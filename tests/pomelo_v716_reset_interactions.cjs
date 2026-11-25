'use strict';
// Run the production handlers with local controls, without a browser or server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function control() {
  return {checked: false, disabled: true, textContent: '', handlers: {},
    addEventListener(type, fn) { this.handlers[type] = fn; },
    change() { this.handlers.change({type: 'change'}); },
    click() { this.handlers.click({type: 'click'}); }};
}
const checks = [control(), control()], collected = control(), reset = control();
const statuses = [control(), control()], progress = [control(), control()];
const announcement = control(), index = control();
const example = {
  dataset: {preparing: 'Preparing', ready: 'Ready', collected: 'Collected', progressLabel: 'Checks', resetDone: 'Order practice reset'},
  querySelectorAll: selector => ({'[data-prep-check]': checks, '[data-pickup-status]': statuses, '[data-prep-progress]': progress})[selector],
  querySelector: selector => ({'[data-pickup-collected]': collected, '[data-pickup-announcement]': announcement, '[data-pickup-reset]': reset})[selector]
};
const document = {documentElement: {dataset: {}, classList: {remove() {}}},
  querySelector: selector => selector === '[data-index-pickup-status]' ? index : null,
  querySelectorAll: selector => selector === '[data-pickup-example]' ? [example] : [], addEventListener() {}};
vm.runInNewContext(fs.readFileSync('demos/corporate/pomelo-stem/v7/assets/app.js', 'utf8'), {document, window: {addEventListener() {}}, console});
assert.equal(reset.disabled, false);
function assertInitial() {
  assert.deepEqual(checks.map(check => check.checked), [false, false]);
  assert.equal(collected.checked, false);
  assert.equal(collected.disabled, true);
  assert.deepEqual(statuses.map(status => status.textContent), ['Preparing', 'Preparing']);
  assert.deepEqual(progress.map(label => label.textContent), ['0 / 2', '0 / 2']);
  assert.equal(index.textContent, 'Preparing');
  assert.equal(announcement.textContent, 'Order practice reset · Preparing · Checks: 0 / 2');
}
checks[0].checked = true; checks[0].change();
assert.equal(announcement.textContent, 'Preparing · Checks: 1 / 2');
reset.click(); assertInitial();
checks.forEach(check => { check.checked = true; check.change(); });
collected.checked = true; collected.change();
assert.equal(index.textContent, 'Collected');
reset.click(); assertInitial();
checks.forEach(check => { check.checked = true; check.change(); });
assert.equal(collected.disabled, false);
assert.equal(index.textContent, 'Ready');
console.log('Pomelo V7.16 order reset handler checks passed');
