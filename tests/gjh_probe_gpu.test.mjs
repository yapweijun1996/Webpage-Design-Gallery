import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script = readFileSync(new URL('../docs/mall_render_probe.js', import.meta.url), 'utf8');

function fixture(timer = true) {
  const pending = [], deleted = [];
  let active, disjoint = false, available = false;
  const ext = {TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2};
  const gl = {
    QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
    getExtension(name) { return name.startsWith('EXT_') && timer ? ext : null; },
    getParameter() { return disjoint; },
    createQuery() { return {}; },
    beginQuery(_, q) { assert.equal(active, undefined); active = q; },
    endQuery() { assert.ok(active); active = undefined; },
    getQueryParameter(_, id) { return id === 3 ? available : 2_500_000; },
    deleteQuery(q) { deleted.push(q); }
  };
  const window = {requestAnimationFrame: fn => pending.push(fn)};
  runInNewContext(script, {window, EventTarget});
  const renderer = {getContext: () => gl, domElement: {id: 'scene'},
    info: {programs: [{}, {}],render:{calls:0,triangles:0}},
    render(scene, camera) {
      for (const object of scene?.objects ?? []) this.renderBufferDirect(camera,scene,null,null,object);
    },
    renderBufferDirect() { this.info.render.calls++; this.info.render.triangles += 12; }};
  window.__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent('observe', {detail: renderer}));
  const scene = {isScene: true, uuid: 'world', traverseVisible(fn) {fn({isPointLight:true}); fn({});}};
  window.__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent('observe', {detail: scene}));
  const probe = window.mallProbe;
  probe.timing = true;
  function frame(at, objects) {
    window.requestAnimationFrame(() => {
      scene.objects = objects;
      renderer.render(scene);
      renderer.render({uuid:'warmup',objects:[{id:10,name:'Warmup'}]});
    });
    pending.shift()(at);
  }
  return {frame, deleted, startOwners: () => probe.startOwners(true,'world'), read: (start = 0) => probe.read(start, 'world'),
    resultReady() { available = true; }, invalidate() { disjoint = true; }};
}

test('the draw census reads renderer.info deltas per object at the peak world frame', () => {
  const f = fixture(false);
  const door = {id:1,name:'Sliding door',parent:{name:'Lift'}};
  f.startOwners();
  f.frame(10,[door,{id:2,name:'Wash'},door]);
  f.frame(20,[{id:2,name:'Wash'}]);
  const {drawOwnerCalls,drawOwners} = JSON.parse(JSON.stringify(f.read()));
  assert.equal(drawOwnerCalls,3);
  assert.deepEqual(drawOwners,[
    {id:1,name:'Lift / Sliding door',calls:2,triangles:24},
    {id:2,name:'Wash',calls:1,triangles:12}
  ]);
});

test('multi-pass render counts one asynchronous GPU query per rendered frame', () => {
  const f = fixture();
  f.frame(10);
  assert.equal(f.read().gpuMs, null);
  f.resultReady();
  const result = f.read();
  assert.equal(result.gpuMs, 2.5);
  assert.equal(result.gpuSamples, 1);
  assert.equal(result.shaderPrograms, 2);
  assert.equal(result.pointLights, 1);
  assert.equal(f.deleted.length, 1);
});

test('disjoint, old and unsupported samples never become GPU milliseconds', () => {
  const f = fixture();
  f.frame(10); f.frame(20); f.invalidate();
  assert.equal(f.read().gpuSamples, 0);
  assert.equal(f.deleted.length, 2);
  const next = fixture();
  next.frame(10); next.resultReady();
  assert.equal(next.read(11).gpuMs, null);
  const missing = fixture(false);
  missing.frame(10);
  assert.equal(missing.read().gpuTimerAvailable, false);
  assert.equal(missing.deleted.length, 0);
});
