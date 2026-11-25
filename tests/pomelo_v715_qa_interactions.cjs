const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
function control(value) {
  return {value, disabled: true, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, change(value) { this.value = value; this.handlers.change(); }};
}
const first = control('0'), second = control('1');
const container = {children: [], appendChild(card) { this.children.splice(this.children.indexOf(card), 1); this.children.push(card); }};
const cards = ['0', '1', '2'].map(id => {
  const position = {};
  return {dataset: {compareCard: id}, parentNode: container, position, attrs: {}, querySelector() { return position; }, setAttribute(key, value) { this.attrs[key] = value; }};
});
container.children = [...cards];
const notice = {};
const comparison = {dataset: {firstLabel: 'First sample', secondLabel: 'Second sample'}, querySelector(selector) { return {'[data-compare-first]': first, '[data-compare-second]': second, '[data-compare-same]': notice}[selector]; }, querySelectorAll() { return cards; }};
const link = control();
const tab = {click() {}}, scene = {click() {}};
const target = {focus(options) { this.focusOptions = options; }};
const document = {documentElement: {dataset: {}, classList: {remove() {}}}, querySelector(selector) { return {'[data-tour-tab="1"]': tab, '[data-scene-kind="1"] [data-scene-button="1"]': scene, '#scene-1-1': target}[selector] || null; }, querySelectorAll(selector) { return {'[data-comparison]': [comparison], '[data-open-delivery]': [link]}[selector] || []; }, addEventListener() {}};
vm.runInNewContext(fs.readFileSync('demos/corporate/pomelo-stem/v7/assets/app.js', 'utf8'), {document, window: {addEventListener() {}}, console});
first.change('2'); second.change('0');
assert.deepEqual(container.children.filter(card => !card.hidden).map(card => card.dataset.compareCard), ['2', '0']);
assert.equal(cards[2].position.textContent, 'First sample');
assert.equal(cards[0].position.textContent, 'Second sample');
assert.equal(cards[2].attrs['aria-labelledby'], 'compare-position-2 compare-name-2');
assert.equal(notice.hidden, true);
second.change('2');
assert.deepEqual(container.children.filter(card => !card.hidden).map(card => card.dataset.compareCard), ['2']);
assert.equal(cards[2].position.textContent, 'First sample / Second sample');
assert.equal(notice.hidden, false);
link.handlers.click();
assert.equal(target.focusOptions.preventScroll, true);
console.log('Pomelo V7.15 QA interaction checks passed');
