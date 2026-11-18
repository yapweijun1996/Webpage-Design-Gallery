import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createModelWarmup} from '../demos/corporate/gjh/v11/assets/model-warmup.js';

test('model warm-up stages the exact renderable and restores the renderer after a failed draw', async () => {
  const scene = new T.Scene(), model = new T.Group(), light = new T.PointLight();
  const map = new T.Texture(), alphaMap = new T.Texture();
  const material = new T.MeshStandardMaterial({map, emissiveMap:map, alphaMap});
  const mesh = new T.InstancedMesh(new T.BoxGeometry(), material, 6);
  const child = new T.Group();
  scene.add(light, model);
  model.add(mesh);
  mesh.add(child);
  mesh.visible = false;
  const originalTarget = new T.WebGLRenderTarget(4, 4);
  let target = originalTarget, face = 3, mip = 1, scissorTest = false, lost = false, linked = false;
  const scissor = new T.Vector4(1, 2, 3, 4);
  const info = {calls:93, triangles:917454, points:0, lines:0};
  const events = [];
  const renderer = {
    toneMapping:T.ACESFilmicToneMapping, autoClear:true,
    shadowMap:{autoUpdate:true, needsUpdate:true}, info:{autoReset:true, render:{...info, frame:17}},
    extensions:{has: name => name === 'KHR_parallel_shader_compile'},
    properties:{get: () => ({currentProgram:{isReady:() => linked}})},
    getContext:() => ({isContextLost:() => lost}),
    getRenderTarget:() => target, getActiveCubeFace:() => face, getActiveMipmapLevel:() => mip,
    setRenderTarget(value, nextFace=0, nextMip=0) { target=value; face=nextFace; mip=nextMip; },
    getScissor:out => out.copy(scissor), getScissorTest:() => scissorTest,
    setScissor: (...args) => args.length === 1 ? scissor.copy(args[0]) : scissor.set(...args),
    setScissorTest: value => { scissorTest=value; },
    initTexture(texture) { events.push(texture); },
    compile(staging) {
      events.push('compile');
      assert.deepEqual(staging.children, [light, mesh]);
      assert.equal(target, null);
      assert.equal(mesh.count, 1);
      assert.equal(mesh.layers.mask, 1);
      return new Set([material]);
    },
    render(staging) {
      events.push('render');
      assert.deepEqual(staging.children, [light, mesh]);
      assert.equal(target, null);
      assert.ok(scissorTest);
      assert.deepEqual(scissor.toArray(), [0, 0, 0, 0]);
      assert.equal(mesh.parent, model);
      assert.equal(mesh.visible, true);
      assert.equal(mesh.frustumCulled, false);
      assert.equal(mesh.children.length, 0);
      assert.equal(renderer.autoClear, false);
      assert.equal(renderer.shadowMap.autoUpdate, false);
      renderer.toneMapping = T.NoToneMapping;
      renderer.info.render.calls = 1;
      renderer.info.render.frame++;
      throw new Error('Optional warm-up draw failed');
    }
  };
  const warmup = createModelWarmup(T, renderer);
  const prepared = warmup.prepare(model, scene, {hide:true});
  const failed = assert.rejects(prepared, /Optional warm-up draw failed/);
  assert.equal(mesh.layers.mask, 0);
  warmup.runFrame(false);
  assert.deepEqual(events, []);
  warmup.runFrame(true);
  assert.deepEqual(events, [map, alphaMap]);
  lost = true;
  warmup.runFrame(true);
  assert.deepEqual(events, [map, alphaMap]);
  lost = false;
  warmup.runFrame(true);
  assert.deepEqual(events, [map, alphaMap, 'compile']);
  warmup.runFrame(true);
  assert.deepEqual(events, [map, alphaMap, 'compile']);
  linked = true;
  warmup.runFrame(true);
  await failed;

  assert.deepEqual(events, [map, alphaMap, 'compile', 'render']);
  assert.equal(mesh.parent, model);
  assert.equal(mesh.visible, false);
  assert.equal(mesh.frustumCulled, true);
  assert.equal(mesh.count, 6);
  assert.equal(mesh.layers.mask, 1);
  assert.deepEqual(mesh.children, [child]);
  assert.equal(light.parent, scene);
  assert.equal(target, originalTarget);
  assert.equal(face, 3);
  assert.equal(mip, 1);
  assert.deepEqual(scissor.toArray(), [1, 2, 3, 4]);
  assert.equal(scissorTest, false);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.toneMapping, T.ACESFilmicToneMapping);
  assert.deepEqual(renderer.shadowMap, {autoUpdate:true, needsUpdate:true});
  assert.deepEqual(renderer.info, {autoReset:true, render:{...info, frame:18}});
  assert.equal(warmup.report().lateAdditions, 0);
});
