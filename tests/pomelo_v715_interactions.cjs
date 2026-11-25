const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
function control(value) {
  return {value, disabled: true, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, change(value) { this.value = value; this.handlers.change(); }};
}
const first = control('0'), second = control('1');
const cards = [0, 1, 2].map(i => ({dataset: {compareCard: String(i)}, hidden: false}));
const comparison = {querySelector: s => ({'[data-compare-first]': first, '[data-compare-second]': second})[s], querySelectorAll: () => cards};
const checks = [control(), control()]; checks.forEach(c => { c.checked = false; });
const collected = control(); collected.checked = false;
const statuses = [{}, {}], progress = [{}, {}], announcement = {}, indexStatus = {};
const order = {dataset: {preparing: 'Preparing', ready: 'Ready', collected: 'Collected'}, querySelectorAll: s => ({'[data-prep-check]': checks, '[data-pickup-status]': statuses, '[data-prep-progress]': progress})[s], querySelector: s => s === '[data-pickup-collected]' ? collected : s === '[data-pickup-announcement]' ? announcement : null};
const tab = {clicks: 0, click() { this.clicks++; }}, scene = {clicks: 0, click() { this.clicks++; }};
const link = control();
const document = {documentElement: {dataset: {}, classList: {remove() {}}}, querySelector: s => ({'[data-index-pickup-status]': indexStatus, '[data-tour-tab="1"]': tab, '[data-scene-kind="1"] [data-scene-button="1"]': scene})[s] || null, querySelectorAll: s => ({'[data-comparison]': [comparison], '[data-pickup-example]': [order], '[data-open-delivery]': [link]})[s] || [], addEventListener() {}};
vm.runInNewContext(fs.readFileSync('demos/corporate/pomelo-stem/v7/assets/app.js', 'utf8'), {document, window: {addEventListener() {}}, console});
assert.equal(first.disabled, false); assert.equal(second.disabled, false);
assert.deepEqual(cards.map(c => c.hidden), [false, false, true]);
first.change('2'); assert.deepEqual(cards.map(c => c.hidden), [true, false, false]);
second.change('2'); assert.deepEqual(cards.map(c => c.hidden), [true, true, false]);
link.handlers.click(); assert.equal(tab.clicks, 1); assert.equal(scene.clicks, 1);
checks[0].checked = true; checks[0].handlers.change(); assert.equal(indexStatus.textContent, 'Preparing');
checks[1].checked = true; checks[1].handlers.change(); assert.equal(indexStatus.textContent, 'Ready');
collected.checked = true; collected.handlers.change(); assert.equal(indexStatus.textContent, 'Collected');
checks[0].checked = false; checks[0].handlers.change(); assert.equal(indexStatus.textContent, 'Preparing'); assert.equal(collected.checked, false);
console.log('Pomelo V7.15 interaction checks passed');
