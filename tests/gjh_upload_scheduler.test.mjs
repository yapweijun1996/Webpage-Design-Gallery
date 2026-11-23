import test from 'node:test';
import assert from 'node:assert/strict';
import {createUploadScheduler} from '../demos/corporate/gjh/v11/assets/model-warmup.js';

function fixture() {
  let time = 0;
  const scheduler = createUploadScheduler({now:() => time});
  const output = [];
  const batch = (name, costs, options) => scheduler.enqueue(function* () {
    for (const [index, cost] of costs.entries()) {
      yield () => { output.push(name + index); time += cost; };
    }
  }, options);
  return {scheduler, output, batch};
}

test('upload slices stop at the time budget and cap tiny operations at two', async () => {
  const {scheduler, output, batch} = fixture();
  const heavy = batch('heavy', [4.5, 1]);
  const small = batch('small', [0.1, 0.1, 0.1]);
  scheduler.runFrame(true);
  assert.deepEqual(output, ['heavy0']);
  assert.deepEqual(scheduler.report(), {lateAdditions:0, maxFrameUploadMs:4.5, pendingUploads:2});
  scheduler.runFrame(true);
  await heavy;
  assert.deepEqual(output, ['heavy0', 'heavy1', 'small0']);
  scheduler.runFrame(true);
  assert.deepEqual(output, ['heavy0', 'heavy1', 'small0', 'small1', 'small2']);
  scheduler.runFrame(true);
  await small;
  assert.deepEqual(scheduler.report(), {lateAdditions:2, maxFrameUploadMs:4.5, pendingUploads:0});
});

test('slices pick the current nearest priority and preserve submission order on ties', async () => {
  const {scheduler, output, batch} = fixture();
  let distance = 10;
  const first = batch('first', [4, 4], {priority:() => distance, late:false});
  const second = batch('second', [4], {priority:() => 10});
  const third = batch('third', [4], {priority:() => 10});
  scheduler.runFrame(true);
  assert.deepEqual(output, ['first0']);
  distance = 20;
  scheduler.runFrame(true);
  assert.deepEqual(output, ['first0', 'second0']);
  distance = 5;
  scheduler.runFrame(true);
  assert.deepEqual(output, ['first0', 'second0', 'first1']);
  scheduler.runFrame(true);
  scheduler.runFrame(true);
  await Promise.all([first, second, third]);
  assert.deepEqual(output, ['first0', 'second0', 'first1', 'third0']);
  assert.equal(scheduler.report().lateAdditions, 2);
});

test('paused decoration work uses its own bounded slice and leaves other uploads queued', async () => {
  const {scheduler, output, batch} = fixture();
  const controller = new AbortController();
  const store = batch('store', [1], {priority:() => -1});
  const theme = batch('theme', [3, 3, 3], {signal:controller.signal});
  scheduler.runFrame(false, 4, controller.signal);
  assert.deepEqual(output, []);
  scheduler.runFrame(true, 4, controller.signal);
  assert.deepEqual(output, ['theme0', 'theme1']);
  controller.abort();
  await assert.rejects(theme, {name:'AbortError'});
  scheduler.runFrame(true, 4, controller.signal);
  assert.deepEqual(output, ['theme0', 'theme1']);
  scheduler.runFrame(true);
  await store;
  assert.deepEqual(output, ['theme0', 'theme1', 'store0']);
});

test('a hidden or transitioning frame holds both the next upload and release', async () => {
  const {scheduler, output, batch} = fixture();
  let released = false;
  const preparing = batch('model', [4, 4]).then(() => { released=true; });
  scheduler.runFrame(false);
  assert.deepEqual(output, []);
  scheduler.runFrame(true);
  scheduler.runFrame(false);
  assert.deepEqual(output, ['model0']);
  scheduler.runFrame(true);
  scheduler.runFrame(false);
  await Promise.resolve();
  assert.equal(released, false);
  scheduler.runFrame(true);
  await preparing;
  assert.deepEqual(output, ['model0', 'model1']);
  assert.equal(released, true);
});

test('context restoration restarts partial uploads and aborted jobs leave the queue', async () => {
  const {scheduler, output, batch} = fixture();
  const controller = new AbortController();
  const first = batch('first', [4, 4]);
  const cancelled = assert.rejects(batch('cancelled', [4], {signal:controller.signal}), {name:'AbortError'});
  scheduler.runFrame(true);
  scheduler.invalidate();
  controller.abort();
  await cancelled;
  scheduler.runFrame(false);
  scheduler.runFrame(true);
  scheduler.runFrame(true);
  scheduler.runFrame(true);
  await first;
  assert.deepEqual(output, ['first0', 'first0', 'first1']);
  assert.equal(scheduler.report().pendingUploads, 0);
});
