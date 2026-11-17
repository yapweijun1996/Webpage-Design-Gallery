import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoaderState} from '../demos/corporate/gjh/v11/assets/loader.js';

test('progress counts only completed startup milestones in order', () => {
  const updates = [], loader = createLoaderState(value => updates.push(value));
  assert.equal(loader.snapshot().completed, 0);
  assert.equal(loader.complete('scene').completed, 0);
  assert.equal(loader.complete('physics').completed, 1);
  assert.equal(loader.complete('physics').completed, 1);
  assert.equal(loader.complete('scene').completed, 2);
  assert.equal(loader.complete('models').completed, 3);
  assert.equal(loader.snapshot().ready, false);
  assert.equal(loader.complete('frame').completed, 4);
  assert.equal(loader.snapshot().ready, true);
  assert.equal(loader.complete('frame').completed, 4);
  assert.equal(updates.at(-1).total, 4);
});

test('a background or lost context cannot complete the first frame', () => {
  const loader = createLoaderState();
  for (const stage of ['physics', 'scene', 'models']) loader.complete(stage);
  loader.visibility(true);
  assert.match(loader.snapshot().message, /visible/);
  assert.equal(loader.complete('frame').ready, false);
  loader.context(true);
  loader.visibility(false);
  assert.match(loader.snapshot().message, /interrupted/);
  assert.equal(loader.complete('frame').ready, false);
  loader.context(false);
  assert.equal(loader.complete('frame').ready, true);
});

test('failure is terminal until reload and directory dismissal stays dismissed', () => {
  const loader = createLoaderState();
  loader.complete('physics');
  loader.fail('Physics could not start.');
  loader.context(true);
  loader.visibility(true);
  assert.equal(loader.snapshot().message, 'Physics could not start.');
  assert.equal(loader.complete('scene').completed, 1);
  assert.equal(loader.snapshot().ready, false);
  loader.dismiss();
  loader.visibility(false);
  assert.equal(loader.snapshot().dismissed, true);
  assert.equal(loader.snapshot().failed, 'Physics could not start.');
});

test('directory dismissal does not manufacture readiness or prevent real completion', () => {
  const loader = createLoaderState();
  loader.dismiss();
  assert.equal(loader.snapshot().ready, false);
  for (const stage of ['physics', 'scene', 'models', 'frame']) loader.complete(stage);
  assert.equal(loader.snapshot().ready, true);
  assert.equal(loader.snapshot().dismissed, true);
});
