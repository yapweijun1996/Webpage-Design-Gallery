import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {expandedLayout} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {createExpandedInteriors} from '../demos/corporate/gjh/v11/assets/expanded-interiors.js';

test('nearby window displays load independently of background furnishings', async t => {
  const idle = [], requests = [], jobs = [];
  const flush = () => new Promise(resolve => setImmediate(resolve));
  globalThis.window = {requestIdleCallback(callback) { idle.push(callback); }};
  globalThis.document = {addEventListener() {}};
  t.after(() => { delete globalThis.window; delete globalThis.document; });
  t.mock.method(globalThis, 'fetch', async url => {
    const file = url.pathname.split('/').pop();
    requests.push(file);
    return new Response(new Uint8Array(4), {status: file === 'speaker-soundbar.glb' ? 404 : 200});
  });
  t.mock.method(GLTFLoader.prototype, 'parseAsync', async () => ({scene: new T.Group()}));

  const scene = new T.Scene();
  let entered = false;
  const prepare = (root, options) => new Promise(resolve => jobs.push({root, options, resolve}));
  const studio = await createExpandedInteriors(T, expandedLayout, scene, undefined,
    prepare, undefined, undefined, () => entered);
  const arrive = (x,z,y=0) => studio.update({x,z,y});
  const hero = id => scene.getObjectByName('S'+id+' hero display');
  const preparation = id => jobs.filter(job => job.root.children[0]?.name === 'S'+id+' pharmacy-counter');

  arrive(34,44);
  assert.equal(idle.length, 0);
  assert.deepEqual(requests, []);
  entered = true;
  arrive(34,44);
  idle.shift()();
  await flush();
  assert.equal(studio.preloadState.shops.find(s=>s.number==='17').status, 'loading');
  const backgroundFiles = [...requests];
  // The nearest upper-floor and remote corridor positions cannot activate a window.
  arrive(20,0,7.2);
  arrive(10,22);
  await flush();
  assert.deepEqual(requests, backgroundFiles);

  arrive(20,0);
  arrive(20,0);
  await flush();
  assert.equal(requests.filter(file=>file==='pharmacy-counter.glb').length, 1);
  assert.equal(preparation('04').length, 1);
  const first = preparation('04')[0];
  const activePriority = first.options.priority();
  assert.equal(hero('04').userData.modelReady, false);
  assert.equal(hero('04').userData.fallbackVisible, true);

  arrive(30,0);
  await flush();
  assert.equal(requests.filter(file=>file==='pharmacy-counter.glb').length, 1);
  assert.equal(preparation('05').length, 1);
  assert(first.options.priority() > activePriority);
  first.resolve();
  await flush();
  assert.equal(hero('04').userData.modelReady, true);
  assert.equal(first.root.visible, false);
  assert.equal(hero('04').userData.fallbackVisible, true);

  arrive(20,0);
  await flush();
  assert.equal(first.root.visible, true);
  assert.equal(hero('04').userData.fallbackVisible, false);
  assert.equal(preparation('04').length, 1);
  assert.equal(studio.preloadState.shops.find(s=>s.number==='17').status, 'loading');
  assert.deepEqual(requests.filter(file=>!backgroundFiles.includes(file)), ['pharmacy-counter.glb']);

  arrive(34,12);
  await flush();
  arrive(20,0);
  arrive(34,12);
  await flush();
  assert.equal(requests.filter(file=>file==='speaker-soundbar.glb').length, 1);
  assert.equal(hero('13').userData.modelReady, false);
  assert.equal(hero('13').userData.fallbackVisible, true);
  for (const job of jobs) job.resolve();
  await flush();
  assert.equal(studio.preloadState.shops.find(s=>s.number==='17').status, 'settled');
});
