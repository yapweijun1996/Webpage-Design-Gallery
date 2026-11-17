import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutorialState, tutorialStorageKey} from '../demos/corporate/gjh/v11/assets/ux-tutorial.js';
import {createInteractionRegistry} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
}
function start(storage = memoryStorage()) {
  const tutorial = createTutorialState({storage: () => storage});
  tutorial.setActive(true); tutorial.offer();
  return tutorial;
}

test('confirmed actions advance only their current sequential step', () => {
  const tutorial = start();
  assert.equal(tutorial.report('look'), false);
  assert.equal(tutorial.report('interact'), false);
  assert.equal(tutorial.snapshot().step, 0);
  assert.equal(tutorial.report('move'), true);
  assert.equal(tutorial.report('move'), false);
  assert.equal(tutorial.snapshot().step, 1);
  assert.equal(tutorial.report('interact'), false);
  assert.equal(tutorial.report('look'), true);
  assert.equal(tutorial.snapshot().step, 2);
  assert.equal(tutorial.report('interact'), true);
  assert.equal(tutorial.snapshot().open, false);
});

test('pose changes, not attempts, advance once per sample and ignore yaw wrapping', () => {
  const tutorial = start();
  const initial = {x: 0, z: 0, yaw: Math.PI - .001};
  tutorial.reportPose(initial);
  tutorial.reportPose(initial);
  assert.equal(tutorial.snapshot().step, 0);
  tutorial.reportPose({x: .2, z: 0, yaw: -Math.PI + .001});
  assert.equal(tutorial.snapshot().step, 1);
  tutorial.reportPose({x: .2, z: 0, yaw: Math.PI - .001});
  assert.equal(tutorial.snapshot().step, 1);
  tutorial.reportPose({x: .2, z: 0, yaw: Math.PI - .2});
  assert.equal(tutorial.snapshot().step, 2);
});

test('suspension excludes movement and resets its baseline on resumption', () => {
  const tutorial = start();
  tutorial.reportPose({x: 0, z: 0, yaw: 0});
  tutorial.setActive(false);
  assert.equal(tutorial.report('move'), false);
  assert.equal(tutorial.next(), false);
  assert.equal(tutorial.reportPose({x: 10, z: 0, yaw: 0}), false);
  tutorial.setActive(true);
  assert.equal(tutorial.reportPose({x: 10, z: 0, yaw: 0}), false);
  assert.equal(tutorial.snapshot().step, 0);
  assert.equal(tutorial.reportPose({x: 10.2, z: 0, yaw: 0}), true);
});

test('Back and Next remain usable without claiming successful gameplay', () => {
  const tutorial = start();
  assert.equal(tutorial.back(), false);
  tutorial.next();
  assert.equal(tutorial.snapshot().step, 1);
  tutorial.back();
  assert.equal(tutorial.snapshot().step, 0);
  tutorial.next(); tutorial.next(); tutorial.next();
  assert.equal(tutorial.snapshot().open, false);
  tutorial.reopen();
  assert.equal(tutorial.snapshot().step, 0);
  assert.equal(tutorial.snapshot().open, true);
});

test('dismissal and completion survive reload while explicit reopen is allowed', () => {
  for (const status of ['dismissed', 'completed']) {
    const storage = memoryStorage(), tutorial = start(storage);
    if (status === 'dismissed') tutorial.dismiss();
    else { tutorial.next(); tutorial.next(); tutorial.next(); }
    assert.equal(storage.getItem(tutorialStorageKey), status);
    const reloaded = createTutorialState({storage: () => storage});
    reloaded.setActive(true);
    assert.equal(reloaded.offer(), false);
    reloaded.reopen();
    assert.equal(reloaded.snapshot().open, true);
    assert.equal(reloaded.snapshot().step, 0);
  }
});

test('denied storage access and writes remain safe in memory', () => {
  for (const storage of [
    () => { throw new Error('Access denied'); },
    () => ({getItem() { throw new Error('Read denied'); }, setItem() { throw new Error('Write denied'); }}),
  ]) {
    const tutorial = createTutorialState({storage});
    tutorial.setActive(true); tutorial.offer(); tutorial.dismiss();
    assert.equal(tutorial.offer(), false);
    tutorial.reopen(); tutorial.next(); tutorial.next(); tutorial.next();
    assert.equal(tutorial.snapshot().remembered, true);
    assert.equal(tutorial.snapshot().open, false);
  }
});

test('every successful registry interaction completes the final step, including modal entry', () => {
  for (const kind of ['inspect', 'open', 'sit', 'travel', 'pickup', 'amenity', 'map']) {
    const tutorial = start(); tutorial.report('move'); tutorial.report('look');
    const registry = createInteractionRegistry([]);
    registry.subscribe(() => tutorial.report('interact'));
    const failed = registry.register({id: 'failed', kind, handler: () => false});
    registry.dispatch(failed);
    assert.equal(tutorial.snapshot().open, true);
    const action = registry.register({id: 'target', kind, handler: () => {
      if (['inspect', 'amenity', 'map'].includes(kind)) tutorial.setActive(false);
      return true;
    }});
    registry.dispatch(action);
    assert.equal(tutorial.snapshot().open, false, kind);
  }
});
