import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createModelWarmup} from '../demos/corporate/gjh/v11/assets/model-warmup.js';

test('model warm-up waits for the first frame and restores render state even when a draw fails', async (t) => {
  const idle = [];
  const keys = ['window', 'document'];
  const originals = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const key of keys) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
      else delete globalThis[key];
    }
  });
  Object.defineProperty(globalThis, 'document', {configurable:true, value:{hidden:false}});
  Object.defineProperty(globalThis, 'window', {configurable:true, value:{requestIdleCallback:callback => idle.push(callback)}});

  const scene = new T.Scene(), model = new T.Group(), light = new T.PointLight();
  const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  scene.add(light);
  model.add(mesh);
  model.visible = false;
  let target = null, disposed = false, compile = 0, renders = 0;
  const info = {calls:93, triangles:917454, points:0, lines:0};
  const renderer = {
    toneMapping:T.ACESFilmicToneMapping,
    shadowMap:{autoUpdate:true, needsUpdate:true}, info:{render:{...info}},
    getContext:() => ({isContextLost:() => false}),
    getRenderTarget:() => target, setRenderTarget:value => { target = value; },
    compile() { compile++; assert.equal(target, null); },
    render(staging) {
      renders++;
      assert.equal(target.width, 1);
      assert.equal(target.height, 1);
      assert.ok(staging.children.some(node => node.isPointLight && node !== light));
      assert.equal(model.parent, staging);
      assert.equal(model.visible, true);
      assert.equal(mesh.frustumCulled, false);
      assert.equal(renderer.shadowMap.autoUpdate, false);
      target.addEventListener('dispose', () => { disposed = true; });
      renderer.toneMapping = T.NoToneMapping;
      renderer.info.render.calls = 1;
      throw new Error('Optional warm-up draw failed');
    }
  };
  let allowWarm = true, release;
  const firstFrame = new Promise(resolve => { release = resolve; });
  const prepare = createModelWarmup(T, renderer, firstFrame, () => allowWarm);
  const prepared = prepare(model, scene);
  await Promise.resolve();
  assert.equal(idle.length, 0);
  release();
  await Promise.resolve();
  assert.equal(idle.length, 1);
  idle.shift()();
  await prepared;

  assert.equal(compile, 1);
  assert.equal(renders, 1);
  assert.equal(model.parent, null);
  assert.equal(model.visible, false);
  assert.equal(mesh.frustumCulled, true);
  assert.equal(light.parent, scene);
  assert.equal(target, null);
  assert.equal(disposed, true);
  assert.equal(renderer.toneMapping, T.ACESFilmicToneMapping);
  assert.deepEqual(renderer.shadowMap, {autoUpdate:true, needsUpdate:true});
  assert.deepEqual(renderer.info.render, info);

  const interrupted = prepare(model, scene);
  await Promise.resolve();
  assert.equal(idle.length, 1);
  allowWarm = false;
  idle.shift()();
  await interrupted;
  assert.equal(renders, 1);
});
