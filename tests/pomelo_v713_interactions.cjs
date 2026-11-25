'use strict';
// Exercise the actual enhancement handlers without starting a browser or server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element(value) {
  return { value, checked: false, disabled: true, textContent: '', listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    change() { this.listeners.change(); } };
}
const product = element('3990'), quantity = element('1'), total = element();
const checks = [element(), element()], collected = element();
const statuses = [element(), element()], progress = [element(), element()], announcement = element();
const estimator = { querySelector: selector => ({'[data-estimate-product]': product, '[data-estimate-quantity]': quantity, '[data-estimate-total]': total})[selector] };
const order = { dataset: {preparing: 'Preparing', ready: 'Ready', collected: 'Collected'},
  querySelectorAll: selector => selector === '[data-prep-check]' ? checks : selector === '[data-prep-progress]' ? progress : statuses,
  querySelector: selector => selector === '[data-pickup-collected]' ? collected : selector === '[data-pickup-announcement]' ? announcement : null };
const document = {documentElement: {dataset: {}, classList: {remove() {}}},
  querySelector() { return null; },
  querySelectorAll(selector) { return selector === '[data-estimator]' ? [estimator] : selector === '[data-pickup-example]' ? [order] : []; },
  addEventListener() {} };
vm.runInNewContext(fs.readFileSync('demos/corporate/pomelo-stem/v7/assets/app.js', 'utf8'),
  {document, window: {addEventListener() {}}, console});
assert.equal(total.textContent, 'RM 39.90');
assert.equal(product.disabled, false);
product.value = '3200'; quantity.value = '3'; quantity.change();
assert.equal(total.textContent, 'RM 96.00');
product.value = '3990'; quantity.value = '6'; product.change();
assert.equal(total.textContent, 'RM 239.40');
assert.equal(collected.disabled, true);
checks[0].checked = true; checks[0].change();
assert.equal(statuses[0].textContent, 'Preparing');
checks[1].checked = true; checks[1].change();
assert.equal(collected.disabled, false);
assert.deepEqual(statuses.map(x => x.textContent), ['Ready', 'Ready']);
collected.checked = true; collected.change();
assert.deepEqual(statuses.map(x => x.textContent), ['Collected', 'Collected']);
assert.equal(announcement.textContent, 'Collected');
checks[0].checked = false; checks[0].change();
assert.equal(collected.checked, false);
assert.equal(collected.disabled, true);
assert.deepEqual(statuses.map(x => x.textContent), ['Preparing', 'Preparing']);
checks[0].checked = true; checks[0].change();
assert.deepEqual(statuses.map(x => x.textContent), ['Ready', 'Ready']);
console.log('Pomelo V7.13 interaction checks passed');
