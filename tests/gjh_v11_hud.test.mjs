import test from 'node:test';
import assert from 'node:assert/strict';
import {createContextQueue, createObjectiveTracker, nearbyStore} from '../demos/corporate/gjh/v11/assets/hud-coordinator.js';

test('context sources preempt lower priorities and reveal the newest queued value', () => {
  const queue = createContextQueue();
  queue.set('quest', 'Visit three stores');
  queue.set('nearby', 'MILI · 12 m');
  queue.set('interaction', 'Inspect');
  queue.set('held', 'Holding Australia 425g');
  assert.deepEqual(queue.current(), {kind: 'held', value: 'Holding Australia 425g'});
  queue.set('quest', 'Inspect a product');
  queue.set('nearby', 'GOGO · 3 m');
  queue.set('held', null);
  assert.deepEqual(queue.current(), {kind: 'interaction', value: 'Inspect'});
  queue.set('interaction', false);
  assert.deepEqual(queue.current(), {kind: 'nearby', value: 'GOGO · 3 m'});
  queue.set('nearby', null);
  assert.deepEqual(queue.current(), {kind: 'quest', value: 'Inspect a product'});
  queue.set('quest', null);
  assert.equal(queue.current(), null);
});

test('store visits count distinct available stores and stop at three', () => {
  const tracker = createObjectiveTracker(['newmoon', 'mili', 'gogo', 'gigaset']);
  for (const id of ['atrium', 'upper', 'missing', 'mili', 'mili', 'newmoon']) tracker.visit(id);
  assert.deepEqual(tracker.progress(), [2, 0, 0]);
  tracker.visit('gogo');
  tracker.visit('gigaset');
  assert.deepEqual(tracker.progress(), [3, 0, 0]);
});

test('inspect and successful bag additions count once and last for this tracker instance', () => {
  const tracker = createObjectiveTracker([], {nz: 2, au: 9});
  tracker.bag({nz: 2, au: 9});
  tracker.bag({nz: 1, au: 9});
  assert.deepEqual(tracker.progress(), [0, 0, 0]);
  tracker.bag({au: 9, mx: 1});
  tracker.inspect();
  tracker.inspect();
  tracker.bag({});
  assert.deepEqual(tracker.progress(), [0, 1, 1]);
  assert.deepEqual(createObjectiveTracker([], {au: 9, mx: 1}).progress(), [0, 0, 0]);
});

const position = {x: 0, z: 0};
const north = {x: 0, z: -1};
const store = (id, x, z, available = true) => ({id, label: id.toUpperCase(), available, arrival: {x, z}});

test('nearby uses the nearest available arrival, skipping the current store', () => {
  const shops = [store('closed', 0, -1, false), store('newmoon', 0, -3),
    store('mili', 0, -11.6), store('gogo', 9, -10)];
  assert.deepEqual(nearbyStore(position, north, shops, 'newmoon'), {id: 'mili', label: 'MILI', metres: 12, sector: 0});
  assert.equal(nearbyStore(position, north, shops, 'newmoon', 10), null);
  assert.equal(nearbyStore(position, north, [store('mili', 0, -20)])?.metres, 20);
});

test('bearings rotate with the camera and handle a vertical camera or arrival overlap', () => {
  const shops = [store('mili', 12, 0)];
  assert.equal(nearbyStore(position, north, shops).sector, 2);
  assert.equal(nearbyStore(position, {x: 1, z: -1}, shops).sector, 1);
  assert.equal(nearbyStore(position, {x: 1, z: 0}, shops).sector, 0);
  assert.equal(nearbyStore(position, {x: 0, z: 1}, shops).sector, 6);
  assert.equal(nearbyStore(position, {x: -1, z: 0}, shops).sector, 4);
  assert.equal(nearbyStore(position, {x: 0, z: 0}, shops).sector, null);
  assert.equal(nearbyStore({x: 12, z: 0}, north, shops).sector, null);
});
