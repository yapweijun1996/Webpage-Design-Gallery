import test from 'node:test';
import assert from 'node:assert/strict';
import {createModes, deriveMode} from '../demos/corporate/gjh/v11/assets/modes.js';

const observation = (changes = {}) => ({seated: false, cartActive: false,
  productOpen: false, bagOpen: false, panelOpen: false, ...changes});

function fixture() {
  const calls = [];
  const hooks = Object.fromEntries(['Exit', 'Cleanup', 'Enter', 'Suspend', 'Restore'].map(name =>
    [`on${name}`, (...args) => calls.push([name, ...args])]));
  return {modes: createModes(hooks), calls};
}

test('lifecycle exits, cleans, suspends, enters and restores once in order', () => {
  const {modes, calls} = fixture();
  modes.observe(observation({seated: true}), 'actual sit');
  calls.length = 0;
  modes.observe(observation({seated: true, bagOpen: true}), 'Bag');
  assert.deepEqual(calls.map(call => call[0]), ['Exit', 'Cleanup', 'Suspend', 'Enter']);
  assert.deepEqual(calls[0].slice(1, 3), ['seated', 'shop']);
  assert.deepEqual(modes.layers(), ['seated', 'shop']);
  assert.equal(modes.paused(), true);
  calls.length = 0;
  modes.observe(observation({seated: true}), 'Close');
  assert.deepEqual(calls.map(call => call[0]), ['Exit', 'Cleanup', 'Enter', 'Restore']);
  assert.deepEqual(calls[3].slice(1, 3), ['seated', 'shop']);
  assert.equal(modes.history().at(-1).kind, 'restore');
  assert.equal(modes.current(), 'seated');
  assert.equal(modes.paused(), false);
  assert.equal(modes.illegalCount(), 0);
});

test('directory Inspect and Shop return to retained Menu then gameplay base', () => {
  for (const base of ['explore', 'seated', 'cart']) {
    const modes = createModes();
    const state = observation({seated: base === 'seated', cartActive: base === 'cart'});
    modes.observe(state);
    modes.observe({...state, panelOpen: true});
    for (const overlay of ['productOpen', 'bagOpen']) {
      modes.observe({...state, panelOpen: true, [overlay]: true});
      assert.equal(modes.current(), overlay === 'productOpen' ? 'inspect' : 'shop');
      modes.observe({...state, panelOpen: true});
      assert.equal(modes.current(), 'menu');
      assert.equal(modes.history().at(-1).kind, 'restore');
    }
    modes.observe(state);
    assert.equal(modes.current(), base);
    assert.equal(modes.illegalCount(), 0);
  }
});

test('repeated observations and requests are idempotent without lifecycle effects', () => {
  const {modes, calls} = fixture();
  modes.observe(observation({panelOpen: true}));
  const history = modes.history();
  calls.length = 0;
  for (let i = 0; i < 50; i++) {
    assert.equal(modes.observe(observation({panelOpen: true})), true);
    assert.equal(modes.request('menu'), true);
  }
  assert.deepEqual(calls, []);
  assert.deepEqual(modes.history(), history);
});

test('commands cannot manufacture gameplay or bypass the retained underlay', () => {
  const {modes, calls} = fixture();
  for (const next of ['seated', 'cart', 'shelf', 'unknown', null, undefined, {}, Symbol('mode')]) {
    assert.equal(modes.request(next, 'unsupported command'), false);
    assert.equal(modes.current(), 'explore');
  }
  assert.deepEqual(calls, []);
  modes.request('menu');
  modes.request('inspect');
  calls.length = 0;
  for (const next of ['explore', 'shop', 'seated', 'cart', 'shelf']) {
    assert.equal(modes.request(next), false);
    assert.deepEqual(modes.layers(), ['explore', 'menu', 'inspect']);
  }
  assert.deepEqual(calls, []);
  assert.equal(modes.request('menu', 'close product'), true);
  assert.equal(modes.request('explore', 'close menu'), true);
  assert.equal(modes.illegalCount(), 13);
});

test('invalid observations fail atomically with no lifecycle effects', () => {
  const {modes, calls} = fixture();
  modes.observe(observation({seated: true, bagOpen: true}));
  const retained = modes.layers();
  calls.length = 0;
  for (const bad of [null, 'shelf', {}, observation({seated: 1}),
    observation({mode: 'shelf'}), observation({seated: true, cartActive: true}),
    observation({bagOpen: true, productOpen: true}), observation({cartActive: true})]) {
    assert.equal(modes.observe(bad), false);
    assert.deepEqual(modes.layers(), retained);
    assert.equal(modes.current(), 'shop');
    assert.equal(modes.paused(), true);
  }
  assert.deepEqual(calls, []);
  assert.equal(modes.illegalCount(), 8);
  assert.equal(modes.history().at(-1).kind, 'reject');
});

test('Inspect cannot be directly replaced by Shop in an observation', () => {
  const {modes, calls} = fixture();
  modes.observe(observation({productOpen: true}));
  calls.length = 0;
  assert.equal(modes.observe(observation({bagOpen: true})), false);
  assert.equal(modes.current(), 'inspect');
  assert.deepEqual(calls, []);
});

test('actual base changes under Shop are retained without fake Explore lifecycle', () => {
  const {modes, calls} = fixture();
  modes.observe(observation({bagOpen: true}));
  calls.length = 0;
  modes.observe(observation({bagOpen: true, cartActive: true}), 'player deployed cart');
  assert.deepEqual(calls.map(call => call[0]), ['Cleanup']);
  assert.equal(modes.history().at(-1).kind, 'underlay');
  assert.deepEqual(modes.layers(), ['cart', 'shop']);
  modes.observe(observation({cartActive: true}), 'Bag handed focus to scene');
  assert.equal(modes.current(), 'cart');
  assert.equal(modes.history().at(-1).kind, 'restore');
  assert.equal(modes.illegalCount(), 0);
});

test('interrupt cleans once without enter, exit or restoring retained gameplay', () => {
  const {modes, calls} = fixture();
  modes.observe(observation({seated: true, panelOpen: true}));
  calls.length = 0;
  modes.interrupt('document hidden');
  assert.deepEqual(calls.map(call => call[0]), ['Cleanup']);
  assert.equal(calls[0][1].kind, 'interrupt');
  assert.deepEqual(modes.layers(), ['seated', 'menu']);
  assert.equal(modes.paused(), true);
});

test('history is bounded and distinguishes restores, rejection and interruptions', () => {
  const modes = createModes();
  for (let i = 0; i < 30; i++) {
    modes.observe(observation({productOpen: true}));
    modes.observe(observation());
  }
  modes.request('shelf', 'reserved');
  modes.interrupt('blur');
  assert.equal(modes.history().length, 20);
  assert.deepEqual(modes.history().slice(-3).map(entry => entry.kind), ['restore', 'reject', 'interrupt']);
  const history = modes.history();
  history.length = 0;
  assert.equal(modes.history().length, 20);
  assert.equal(Object.isFrozen(modes.history()[0]), true);
  assert.equal(modes.sync, undefined, 'forced-invalid sync back door is removed');
});

test('derived mode priority agrees with accepted observation', () => {
  const modes = createModes();
  for (const change of [{}, {cartActive: true}, {cartActive: true, panelOpen: true},
    {cartActive: true, panelOpen: true, bagOpen: true}]) {
    const signals = observation(change);
    modes.observe(signals);
    assert.equal(modes.current(), deriveMode(signals));
  }
});
