import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createWarmReport, createWarmRunner, createTierQueue, mallProbePoses, prepareScene} from '../demos/corporate/gjh/v11/assets/scene-warmup.js';
import {createModelWarmup} from '../demos/corporate/gjh/v11/assets/model-warmup.js';
import {createLoaderState} from '../demos/corporate/gjh/v11/assets/loader.js';
import {expandedLayout, shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';

function clock() {
  let time = 0, timer;
  return {
    now:() => time,
    setTimer(callback, delay) { timer = {callback, at:time + delay}; return timer; },
    clearTimer() { timer = null; },
    advance(ms) { time += ms; if (timer && timer.at <= time) timer.callback(); }
  };
}

test('slices yield to paint at the budget and resume after visibility returns', () => {
  const time = clock(), report = createWarmReport(), outcomes = [];
  let count = 0;
  function* work() { while (count < 9) { count++; time.advance(3); yield; } }
  const runner = createWarmRunner(work(), report, {...time, budgetMs:8, lost:() => false, onFinish:r => outcomes.push(r.reason)});
  runner.runFrame();
  assert.equal(count, 3);
  runner.visibility(true);
  time.advance(7000);
  runner.runFrame();
  assert.equal(count, 3);
  assert.deepEqual(outcomes, []);
  runner.visibility(false);
  for (let i = 0; i < 5; i++) runner.runFrame();
  assert.equal(count, 9);
  assert.deepEqual(outcomes, ['complete']);
  assert.equal(report.skipped, false);
  assert.equal(report.ms, 27);
});

test('six-second watchdog releases a stalled driver even without another foreground RAF', () => {
  const time = clock(), report = createWarmReport();
  let polls = 0, cleaned = 0, finished = 0;
  function* work() { try { while (true) { polls++; yield false; } } finally { cleaned++; } }
  const runner = createWarmRunner(work(), report, {...time, budgetMs:10, lost:() => false, onFinish:() => finished++});
  runner.runFrame();
  time.advance(5000);
  runner.visibility(true);
  time.advance(8000);
  runner.visibility(false);
  time.advance(999);
  assert.equal(finished, 0);
  time.advance(1);
  runner.runFrame();
  assert.deepEqual([report.ms, report.skipped, report.reason, polls, cleaned, finished], [6000, true, 'timeout', 1, 1, 1]);
});

test('Enter now and directory dismissal cancel pending steps and keep the real frame prerequisite', () => {
  for (const reason of ['enter-now', 'directory']) {
    const loader = createLoaderState();
    loader.enterNow();
    assert.equal(loader.skipSignal.aborted, false);
    for (const stage of ['physics', 'scene', 'models', 'frame']) loader.complete(stage);
    const time = clock(), report = createWarmReport();
    let work = 0;
    function* steps() { while (true) { work++; yield false; } }
    const runner = createWarmRunner(steps(), report, {...time, budgetMs:12, signal:loader.skipSignal,
      lost:() => false, onFinish:() => loader.complete('warm')});
    runner.runFrame();
    if (reason === 'directory') loader.dismiss(); else loader.enterNow();
    runner.runFrame();
    time.advance(9000);
    assert.deepEqual([loader.snapshot().ready, report.reason, report.skipped, work], [true, reason, true, 1]);
  }
});

test('context loss between steps prevents further submission', () => {
  const time = clock(), report = createWarmReport();
  let lost = false, calls = 0;
  function* work() { calls++; lost = true; yield; calls++; }
  const runner = createWarmRunner(work(), report, {...time, budgetMs:8, lost:() => lost, onFinish:() => {}});
  runner.runFrame();
  runner.runFrame();
  assert.deepEqual([calls, report.skipped, report.reason], [1, true, 'context-loss']);
});

test('probe poses use every live entrance, the atrium and the active upper deck', () => {
  const poses = mallProbePoses(true);
  assert.equal(poses.length, 20);
  const chase={height:3,distance:5,pitch:-.2};
  const atriumViews=mallProbePoses(true,undefined,chase).slice(20);
  assert.equal(atriumViews.length,3);
  assert.ok(atriumViews.every(pose=>pose.chase===chase && pose.y===0));
  assert.deepEqual(poses[0], {...expandedLayout.atrium, y:0, yaw:0});
  assert.deepEqual(poses[1], {...expandedLayout.entrance, y:0, yaw:0});
  for (const [i, slot] of expandedLayout.slots.entries()) {
    const door = shopEntrance(slot), pose = poses[i + 2];
    assert.equal(pose.yaw, door.yaw);
    assert.equal(pose.x - 2.4 * door.normalX, door.x);
    assert.equal(pose.z - 2.4 * door.normalZ, door.z);
  }
  assert.equal(poses.at(-1).y, expandedLayout.lift.upper);
  assert.equal(mallProbePoses(false).length, 4);
  assert.equal(mallProbePoses(false, {x:0, z:16, upper:7.2}).length, 5);
});

function sceneFixture(detailed, failDraw = false, parallel = true, corridorOnly = false, stagingOptions={}) {
  const scene = new T.Scene(), group = new T.Group(), camera = new T.PerspectiveCamera();
  const map = new T.Texture(), uniform = new T.Texture(), environment = new T.Texture();
  const a = new T.MeshStandardMaterial({map, emissiveMap:map});
  const b = new T.ShaderMaterial({uniforms:{maps:{value:[map, uniform]}}});
  const instances = new T.InstancedMesh(new T.BoxGeometry(), [a,b], 3);
  const child = new T.Mesh(new T.BoxGeometry(), a), point = new T.PointLight();
  const ambient = new T.AmbientLight();
  instances.castShadow=true;
  group.add(instances); instances.add(child); scene.add(group, point, ambient);
  scene.environment = environment;
  instances.visible = group.visible = b.visible = point.visible = false;
  instances.layers.mask = 0;
  child.layers.enable(1);
  child.frustumCulled = false;
  camera.position.set(5, 7, 9);
  const originalTarget = {}, viewport = new T.Vector4(0,0,393,612), scissor = new T.Vector4(2,3,4,5);
  let target = originalTarget, face = 2, mip = 1, testScissor = false, linked = false, gpuDone = false;
  let deleted = 0, fence = null;
  const draws = [], compiles = [], textures = [], report = createWarmReport();
  const program = {isReady:() => linked};
  const gl = {
    TIMEOUT_EXPIRED:1, WAIT_FAILED:2, CONDITION_SATISFIED:3,
    isContextLost:() => false, fenceSync:() => (fence = {}), flush() {},
    clientWaitSync:() => gpuDone ? 3 : 1, deleteSync() { deleted++; }
  };
  const renderer = {
    extensions:{has:() => parallel}, properties:{get:() => ({programs:new Map([['key',program]])})},
    autoClear:false, shadowMap:{enabled:false,autoUpdate:true, needsUpdate:true}, info:{render:{calls:7, triangles:8, lines:0, points:0}},
    getContext:() => gl, getRenderTarget:() => target, getActiveCubeFace:() => face, getActiveMipmapLevel:() => mip,
    getViewport:v => v.copy(viewport), getScissor:v => v.copy(scissor), getScissorTest:() => testScissor,
    setScissorTest:v => { testScissor = v; },
    setViewport:(...args) => args.length === 1 ? viewport.copy(args[0]) : viewport.set(...args),
    setScissor:(...args) => args.length === 1 ? scissor.copy(args[0]) : scissor.set(...args),
    setRenderTarget:(value, f=0, m=0) => { target = value; face = f; mip = m; },
    compile(staging) { compiles.push(staging.children.slice()); return new Set([a,b]); },
    render(staging, probe) {
      assert.ok(linked || !parallel);
      assert.notEqual(probe, camera);
      assert.notEqual(target, originalTarget);
      if (!target) { assert.ok(testScissor); assert.deepEqual(viewport.toArray(), [0,0,1,1]); }
      for (const node of staging.children) {
        assert.equal(node.visible, true);
        assert.equal(node.frustumCulled, false);
        assert.equal(node.layers.mask, 1);
      }
      if (staging.children.includes(instances)) {
        assert.equal(instances.children.length, 0);
        assert.equal(instances.count, 1);
        assert.equal(b.visible, true);
      }
      draws.push({objects:staging.children.slice(), pose:probe.position.toArray(), linear:Boolean(target), depth:renderer.shadowMap.needsUpdate, shadows:renderer.shadowMap.enabled});
      if (failDraw) throw Error('injected draw failure');
    }
  };
  const work = prepareScene({T, renderer, scene, camera, expanded:true, detailed,
    ...stagingOptions,initTexture:t => textures.push(t), updateLights:pose => {
      point.visible = corridorOnly ? pose.z > 15 && pose.z < 18 : pose.z < 30;
    }}, report);
  function restored() {
    assert.deepEqual([instances.visible, group.visible, b.visible, point.visible], [false,false,false,false]);
    assert.equal(instances.frustumCulled, true);
    assert.equal(child.frustumCulled, false);
    assert.equal(instances.layers.mask, 0);
    assert.deepEqual(instances.children, [child]);
    assert.equal(instances.count, 3);
    assert.equal(child.parent, instances);
    assert.equal(renderer.autoClear, false);
    assert.deepEqual(renderer.shadowMap, {autoUpdate:true, needsUpdate:true, enabled:false});
    assert.deepEqual([target,face,mip,testScissor], [originalTarget,2,1,false]);
    assert.deepEqual(viewport.toArray(), [0,0,393,612]);
    assert.deepEqual(scissor.toArray(), [2,3,4,5]);
    assert.deepEqual(camera.position.toArray(), [5,7,9]);
  }
  return {work, restored, report, draws, compiles, instances, child, point, textures, expectedTextures:[map,uniform,environment],
    link() { linked = true; }, signal() { gpuDone = true; }, get fence() { return fence; }, get deleted() { return deleted; }};
}

for (const detailed of [false, true]) {
  test('covers hidden geometry, shader/light variants and textures, then waits for the GPU (' +
    (detailed ? 'detailed' : 'low') + ')', () => {
    const f = sceneFixture(detailed);
    let steps = 0;
    while (f.work.next().value !== false) { f.restored(); assert.ok(++steps < 1000); }
    assert.equal(f.draws.length, 0);
    assert.ok(f.compiles.length);
    f.link();
    while (!f.fence) { f.work.next(); f.restored(); assert.ok(++steps < 2000); }
    assert.ok(f.draws.some(draw => draw.objects.includes(f.instances)));
    assert.ok(f.draws.some(draw => draw.objects.includes(f.child)));
    assert.ok(f.draws.some(draw => draw.objects.includes(f.point)));
    assert.ok(f.draws.some(draw => !draw.objects.includes(f.point)));
    assert.equal(f.draws.some(draw => draw.linear), detailed);
    assert.ok(f.draws.some(draw => !draw.linear));
    assert.deepEqual(new Set(f.textures), new Set(f.expectedTextures));
    assert.equal(f.textures.length, 3);
    assert.deepEqual([f.report.programs, f.report.textures, f.report.probes], [1,3,20]);
    assert.equal(f.work.next().done, false);
    f.signal();
    assert.equal(f.work.next().done, true);
    assert.equal(f.deleted, 1);
  });
}

test('draw failure restores exact mesh and renderer state; cancelling a pending fence releases it', () => {
  const failed = sceneFixture(false, true);
  failed.link();
  assert.throws(() => { for (const _ of failed.work) { /* exhaust until draw */ } }, /injected draw failure/);
  failed.restored();
  const cancelled = sceneFixture(false);
  cancelled.link();
  while (!cancelled.fence) cancelled.work.next();
  cancelled.work.return();
  cancelled.restored();
  assert.equal(cancelled.deleted, 1);
});

test('a corridor-only lighting variant draws without the parallel compile extension', () => {
  const f = sceneFixture(false, false, false, true);
  let steps = 0;
  while (!f.fence) { f.work.next(); assert.ok(++steps < 2000); }
  assert.ok(f.draws.some(draw => draw.pose[2] > 15 && draw.pose[2] < 18 && draw.objects.includes(f.point)));
  assert.equal(f.report.probes, 21);
  f.signal();
  assert.equal(f.work.next().done, true);
  f.restored();
});

test('manual and Auto targets share one sliced job and only the latest ready target commits',async()=>{
  const uploader=createModelWarmup(T,{getContext:()=>({isContextLost:()=>false})});
  const queue=createTierQueue(uploader.enqueueSweep);
  let active='low', linked=false;
  const closed=[], submitted=[];
  function* warm(tier) {
    try {
      submitted.push(tier);
      while(!linked)yield false;
      active=tier;
    } finally {closed.push(tier);}
  }
  const first=queue.request('balanced',()=>warm('balanced'));
  assert.equal(queue.request('balanced',()=>assert.fail('duplicate job')),first);
  uploader.runFrame(false);assert.deepEqual(submitted,[]);
  uploader.runFrame(true);assert.equal(active,'low');
  const next=queue.request('detailed',()=>warm('detailed'));
  await first;assert.deepEqual(closed,['balanced']);assert.equal(queue.pending,true);
  uploader.runFrame(true);assert.equal(active,'low');
  linked=true;uploader.runFrame(false);assert.equal(active,'low');
  uploader.runFrame(true);uploader.runFrame(true);await next;
  assert.equal(active,'detailed');assert.equal(queue.pending,false);
  assert.deepEqual(submitted,['balanced','detailed']);
  assert.deepEqual(uploader.report().pendingUploads,0);
  const interrupted=queue.request('low',()=>warm('low'));
  queue.cancel();await interrupted;
  assert.equal(active,'detailed');assert.equal(uploader.report().lateAdditions,0);
  uploader.dispose();
});

test('shadow and light policy warm detached tier meshes before the fence, even for counts absent at the doors',()=>{
  const map=new T.Texture(), staged=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({map}));
  const lights=[new T.PointLight(),new T.PointLight(),new T.PointLight()];
  const f=sceneFixture(false,false,true,false,{shadows:true,extra:[staged],
    lightVariants:sceneLights=>[[...sceneLights,...lights]]});
  f.link();
  while(!f.fence)f.work.next();
  assert.ok(f.textures.includes(map));
  assert.ok(f.draws.some(draw=>draw.depth && draw.shadows && draw.objects.includes(f.instances)));
  assert.ok(f.draws.some(draw=>draw.objects.includes(staged) && lights.every(light=>draw.objects.includes(light))));
  assert.equal(f.report.shadowCasters,1);
  assert.equal(staged.parent,null);
  f.restored();
  f.signal();assert.equal(f.work.next().done,true);
});
