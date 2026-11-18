import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoaderState, loaderLabels} from '../demos/corporate/gjh/v11/assets/loader.js';

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
  assert.equal(loader.snapshot().ready, false);
  assert.equal(loader.snapshot().message, 'Preparing the mall details…');
  assert.equal(loader.snapshot().preparing, true);
  assert.equal(loader.complete('warm').completed, 5);
  assert.equal(loader.snapshot().ready, true);
  assert.equal(loader.complete('warm').completed, 5);
  assert.equal(updates.at(-1).total, 5);
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
  assert.equal(loader.complete('frame').completed, 4);
  loader.context(true);
  assert.equal(loader.complete('warm').ready, false);
  loader.visibility(true);
  loader.context(false);
  assert.equal(loader.complete('warm').ready, false);
  loader.visibility(false);
  assert.equal(loader.complete('warm').ready, true);
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
  for (const stage of ['physics', 'scene', 'models', 'frame', 'warm']) loader.complete(stage);
  assert.equal(loader.snapshot().ready, true);
  assert.equal(loader.snapshot().dismissed, true);
});

test('model preparation remains optional and can finish or be skipped', () => {
  for (const message of ['Preparing 2/10 models','Preparing models; some may be unavailable']) {
    const loader=createLoaderState();
    for(const stage of ['physics','scene','models'])loader.complete(stage);
    loader.prepare(message);
    assert.equal(loader.snapshot().ready,false);
    assert.equal(loader.snapshot().preparing,true);
    assert.equal(loader.snapshot().message,message);
    loader.complete('frame');
    assert.equal(loader.snapshot().message, 'Preparing the mall details…');
    loader.complete('warm');
    assert.equal(loader.snapshot().ready,true);
    assert.equal(loader.snapshot().preparing,false);
  }
});

test('the last step follows the selected mall language and preserves interruption status', () => {
  const loader = createLoaderState();
  for (const stage of ['physics','scene','models']) loader.complete(stage);
  assert.equal(loaderLabels(loader.snapshot(), 'ms').lastStep, null);
  loader.complete('frame');
  const state = loader.snapshot();
  assert.deepEqual(loaderLabels(state, 'en'), {status:'Preparing the mall details…', lastStep:'Details'});
  assert.deepEqual(loaderLabels(state, 'zh-Hans'), {status:'正在准备商场细节…', lastStep:'细节'});
  assert.deepEqual(loaderLabels(state, 'ms'), {status:'Menyediakan butiran pusat beli-belah…', lastStep:'Butiran'});
  assert.match(loaderLabels(loader.visibility(true), 'ms').status, /paused/);
});

test('Enter now during model preparation skips the subsequent GPU wait', () => {
  const loader = createLoaderState();
  for (const stage of ['physics','scene','models']) loader.complete(stage);
  loader.prepare('Preparing shop models');
  loader.enterNow();
  assert.equal(loader.skipSignal.reason, 'enter-now');
  assert.equal(loader.snapshot().ready, false);
  assert.equal(loader.complete('frame').stage, 'warm');
  assert.equal(loader.skipSignal.aborted, true);
  assert.equal(loader.complete('warm').ready, true);
});
