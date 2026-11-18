import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chaseDistance, clampZoom, createCameraController, easeCameraValue, firstPersonFov
} from '../demos/corporate/gjh/v11/assets/camera-controller.js';

test('zoom clamps numeric inputs and rejects invalid storage values', () => {
  assert.equal(clampZoom(2), 1);
  assert.equal(clampZoom(-2), -1);
  assert.equal(clampZoom(.35), .35);
  for (const value of [null, undefined, NaN, Infinity, '-.5']) assert.equal(clampZoom(value), 0);
});

test('third-person zoom preserves neutral viewport framing and reaches both limits', () => {
  for (const neutral of [5, 5.2, 5.5, 6.5]) {
    assert.equal(chaseDistance(neutral, 0), neutral);
    assert.equal(chaseDistance(neutral, 2), 1);
    assert.equal(chaseDistance(neutral, -2), 11);
    assert.ok(chaseDistance(neutral, .5) < neutral);
    assert.ok(chaseDistance(neutral, -.5) > neutral);
  }
});

test('first-person zoom maps from a wide 75° to a narrow 40° field of view', () => {
  assert.equal(firstPersonFov(-1), 75);
  assert.equal(firstPersonFov(0), 57.5);
  assert.equal(firstPersonFov(1), 40);
  assert.equal(firstPersonFov(2), 40);
  assert.equal(firstPersonFov(-2), 75);
});

test('zoom easing is monotonic, frame-rate independent and settles exactly', () => {
  const halfway = easeCameraValue(11, 1, 1 / 30);
  const split = easeCameraValue(easeCameraValue(11, 1, 1 / 60), 1, 1 / 60);
  assert.ok(1 < halfway && halfway < 11);
  assert.ok(Math.abs(split - halfway) < 1e-12);
  assert.equal(easeCameraValue(11, 1, 0), 11);
  assert.equal(easeCameraValue(40.00001, 40, 1 / 60), 40);
  assert.equal(easeCameraValue(75, 40, 0, true), 40);
  assert.equal(easeCameraValue(1, 11, 0, true), 11);
});

test('view switching restores independent zoom settings after temporary chase framing', () => {
  const camera = createCameraController(() => null);
  assert.equal(camera.mode(), 'third-person');
  assert.equal(camera.adjust(-.5), true);
  assert.equal(camera.toggle(), true);
  assert.equal(camera.mode(), 'first-person');
  assert.equal(camera.zoom(), 0);
  assert.equal(camera.adjust(.75), true);
  assert.equal(camera.mode(true), 'third-person');
  assert.equal(camera.zoom(true), 0);
  assert.equal(camera.toggle(true), false);
  assert.equal(camera.adjust(-1, true), false);
  assert.equal(camera.mode(), 'first-person');
  assert.equal(camera.zoom(), .75);
  camera.toggle();
  assert.equal(camera.mode(), 'third-person');
  assert.equal(camera.zoom(), -.5);
  camera.toggle();
  assert.equal(camera.zoom(), .75);
});

test('session reload retains both zoom settings and starts in third person', () => {
  const saved = new Map();
  const storage = {getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value)};
  const before = createCameraController(() => storage);
  assert.equal(before.adjust(-10), true);
  assert.equal(before.adjust(-1), false);
  assert.equal(before.adjust(Infinity), false);
  before.toggle();
  before.adjust(.5);
  const after = createCameraController(() => storage);
  assert.equal(after.mode(), 'third-person');
  assert.equal(after.zoom(), -1);
  after.toggle();
  assert.equal(after.zoom(), .5);
});

test('invalid session data falls back independently by view', () => {
  const camera = createCameraController(() => ({getItem: () => '{"chase":"-.5","eye":4}'}));
  assert.equal(camera.zoom(), 0);
  camera.toggle();
  assert.equal(camera.zoom(), 1);
  assert.equal(createCameraController(() => ({getItem: () => '{'})).zoom(), 0);
});
