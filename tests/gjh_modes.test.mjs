import test from 'node:test';
import assert from 'node:assert/strict';
import {createModes, deriveMode} from '../demos/corporate/gjh/v11/assets/modes.js';

test('legal and illegal requests preserve state and count rejected moves', () => {
  const modes = createModes();
  assert.equal(modes.request('menu', 'open map'), true);
  assert.equal(modes.current(), 'menu');
  assert.equal(modes.request('shop', 'open bag'), true);
  assert.equal(modes.request('seated'), false);
  assert.equal(modes.current(), 'shop');
  assert.equal(modes.illegalCount(), 1);
  assert.equal(modes.history().at(-1).reason, '');
});

test('shelf has no request entry edge and history is bounded', () => {
  const modes = createModes();
  assert.equal(modes.request('shelf'), false);
  for (let i = 0; i < 30; i++) modes.sync(i % 2 ? 'explore' : 'inspect', `sync-${i}`);
  assert.equal(modes.history().length, 20);
});

test('derived mode priority covers all states', () => {
  const base = {productOpen:false, bagOpen:false, panelOpen:false, seated:false, cartActive:false};
  assert.equal(deriveMode(base), 'explore');
  assert.equal(deriveMode({...base, cartActive:true}), 'cart');
  assert.equal(deriveMode({...base, seated:true, cartActive:true}), 'seated');
  assert.equal(deriveMode({...base, panelOpen:true, seated:true}), 'menu');
  assert.equal(deriveMode({...base, bagOpen:true, panelOpen:true}), 'shop');
  assert.equal(deriveMode({...base, productOpen:true, bagOpen:true}), 'inspect');
});

test('sync is authoritative and records rejected transition reason', () => {
  const modes = createModes();
  modes.sync('seated', 'sit');
  modes.sync('inspect', 'dialog opened');
  assert.equal(modes.current(), 'inspect');
  assert.equal(modes.illegalCount(), 1);
  assert.equal(modes.history()[1].reason, 'dialog opened');
});
