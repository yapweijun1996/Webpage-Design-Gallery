import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {test} from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {expandedLayout,shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {createExpandedInteriors} from '../demos/corporate/gjh/v11/assets/expanded-interiors.js';
import {createSeatPlacements} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {
  interiorAsset,interiorRoutes,interiorStores,interiorTiers,radians,worldInteriorBox
} from '../demos/corporate/gjh/v11/assets/interiors/config.js';
import {buildInteriorDecoration,interiorMaterials} from '../demos/corporate/gjh/v11/assets/interiors/decoration.js';
import {floorFinish} from '../demos/corporate/gjh/v11/assets/interiors/surfaces.js';
import {createInteriorKit} from '../demos/corporate/gjh/v11/assets/interiors/runtime.js';
import {registerInteriorWarmup} from '../demos/corporate/gjh/v11/assets/interiors/warmup.js';
import {createWarmReport,createWarmRunner,prepareTier} from '../demos/corporate/gjh/v11/assets/scene-warmup.js';
import {createInteriorModelLoader,disposeInteriorModel} from '../demos/corporate/gjh/v11/assets/interiors/models.js';

const assets = new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
const folder = new URL('interiors/',assets);
const planBytes = readFileSync(new URL('../docs/gjh-v11-interior-program.json',import.meta.url));
const plan = JSON.parse(planBytes);
const manifest = JSON.parse(readFileSync(new URL('manifest.json',folder)));
const plans = new Map(plan.stores.map(store => [store.id,store]));
const stores = Object.values(interiorStores);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const round = x => +x.toFixed(6);
const counts = root => {
  let triangles = 0, calls = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const count = mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count;
    triangles += count/3 * (mesh.isInstancedMesh ? mesh.count : 1);
    calls++;
  });
  return {triangles,calls};
};

test('interior programme pins 17 world frames, anchors, floor fields, palettes, and prop sockets', () => {
  assert.equal(manifest.plan_sha256,sha(planBytes));
  assert.deepEqual(stores.map(store=>store.id),plan.stores.map(store=>store.id));
  assert.equal(new Set(stores.map(store=>store.floor.pattern)).size,17);
  const assertFields = (actual,approved) => {
    for (const key of Object.keys(actual)) assert.deepEqual(actual[key],approved[key],key);
  };
  for (const store of stores) {
    const approved = plans.get(store.id);
    const slot = expandedLayout.slots.find(slot=>'S'+slot.number === store.id);
    const door = shopEntrance(slot);
    assert.deepEqual(store.frame.world_origin_m,[(slot.minX+slot.maxX)/2,0,(slot.minZ+slot.maxZ)/2]);
    assert.equal(radians(store.frame.yaw_world_deg),door.yaw);
    assert.deepEqual(worldInteriorBox(store,{center:[0,0,store.frame.threshold_local_xz_m[1]],size:[1,1,1],yaw:0})
      .center.map(round),[door.x,0,door.z]);
    assertFields(store.frame,approved.frame);
    assertFields(store.anchor,approved.anchor);
    const {pattern,colours,...floor} = store.floor;
    assert.deepEqual(floor,approved.floor);
    assert(colours.every(value => store.palette[value] || /^#[0-9A-F]{6}$/.test(value)));
    for (const field of ['brand','style','concept','signature_family','palette','capture']) assert.deepEqual(store[field],approved[field]);
    assert.equal(store.accent_kelvin,approved.lighting.accent_kelvin);
    assert.deepEqual(store.lighting,approved.lighting.position_m);
    assert.deepEqual(store.routes,approved.additional_clearance_segments);
    assert.deepEqual(store.pickups,approved.shelf_pickups_local_xz_m ?? []);
    assert(store.props.length >= 8 && store.props.length <= 14);
    for (const [{kind,...prop},spec] of store.props.map((p,i)=>[p,approved.props[i]])) {
      assert(kind);
      assertFields(prop,spec);
    }
  }
});

test('tier selection resolves only delivered files, with Balanced used for missing Detailed', () => {
  assert.equal(manifest.assets.length,42);
  assert.deepEqual(readdirSync(folder).filter(file=>file.endsWith('.glb')).sort(),
    manifest.assets.map(asset=>asset.file).sort());
  for (const store of stores) {
    const files = manifest.assets.filter(asset => asset.store === store.id);
    for (const tier of interiorTiers) {
      const expected = files.find(asset=>asset.tier.toLowerCase()===tier)
        ?? files.find(asset=>asset.tier==='Balanced');
      assert.equal(interiorAsset(store,tier).file,expected.file);
      assert.equal(interiorAsset(store,tier).bytes,expected.bytes);
      assert.equal(interiorAsset(store,tier).tier,expected.tier.toLowerCase());
    }
  }
});

test('every tier fits its programme budget using parsed GLBs and the actual merged room meshes', async t => {
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis,'fetch',async (url,options) =>
    url.protocol === 'file:' ? new Response(readFileSync(url)) : realFetch(url,options));
  globalThis.self = globalThis;
  // Three's bitmap loader still reads the embedded PNG blobs. Node substitutes
  // IHDR dimensions for the browser's image decoder and has no WebGL uploads.
  globalThis.createImageBitmap = async blob => {
    const png = Buffer.from(await blob.arrayBuffer());
    assert.equal(png.toString('ascii',12,16),'IHDR');
    return {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
  };
  t.after(()=>{ delete globalThis.self; delete globalThis.createImageBitmap; });
  const load = createInteriorModelLoader(T,assets,new GLTFLoader());
  const models = new Map(), signal = new AbortController().signal;
  for (const receipt of manifest.assets) {
    const file = readFileSync(new URL(receipt.file,folder));
    assert.equal(file.length,receipt.bytes);
    assert.equal(sha(file),receipt.sha256);
    const doc = JSON.parse(file.subarray(20,20+file.readUInt32LE(12)));
    assert(doc.images.every(image=>image.bufferView !== undefined && !image.uri));
    const model = await load({...receipt,tier:receipt.tier.toLowerCase()},signal);
    const measured = counts(model), bounds = new T.Box3().setFromObject(model);
    assert.equal(measured.triangles,receipt.triangles,receipt.file);
    assert(measured.triangles <= receipt.triangle_cap);
    assert.deepEqual(bounds.min.toArray().map(round),receipt.bounds_m.min.map(round));
    assert.deepEqual(bounds.max.toArray().map(round),receipt.bounds_m.max.map(round));
    assert(Math.abs(bounds.min.y) < 1e-6,receipt.file);
    const envelope = plans.get(receipt.store).anchor.envelope_whd_m;
    assert(bounds.getSize(new T.Vector3()).toArray().every((extent,i)=>extent <= envelope[i]+1e-5));
    assert(model.children.every(mesh=>!mesh.material.transparent),'Opaque floor kit');
    models.set(receipt.file,measured);
    disposeInteriorModel(model);
  }
  const materials = interiorMaterials(T), summary = [];
  for (const [level,tier] of interiorTiers.entries()) {
    const title = tier[0].toUpperCase()+tier.slice(1);
    let triangles=0, calls=0, bytes=0, maxShop=0, maxCalls=0, anchorTriangles=0, textureBytes=0, largest;
    const perShop = {};
    for (const store of stores) {
      const asset = interiorAsset(store,tier);
      const anchor = models.get(asset.file);
      const photoFaces = store.id === 'S01' ? 2 : 0;
      const total = {triangles:anchor.triangles+photoFaces*2,calls:anchor.calls+photoFaces};
      for (let i=0;i<=level;i++) {
        const detail = buildInteriorDecoration(T,store,materials,i);
        const decor = counts(detail);
        total.triangles += decor.triangles;
        total.calls += decor.calls;
        detail.traverse(mesh => mesh.geometry?.dispose());
      }
      const budget = plans.get(store.id).budgets[title];
      assert(total.triangles <= budget.triangles,store.id+' '+tier);
      assert(total.calls <= budget.draw_calls,store.id+' '+tier);
      if (tier === 'low') assert(total.triangles <= plan.owner_caps.Low_store_triangles);
      const textures = manifest.assets.find(entry=>entry.file===asset.file).textures;
      const mipBytes = (width,height) => {
        let sum = 0;
        while (true) {
          sum += 4*width*height;
          if (width===1 && height===1) return sum;
          width = Math.max(1,width>>1); height = Math.max(1,height>>1);
        }
      };
      const nominal = textures.reduce((sum,{width,height})=>sum+mipBytes(width,height),0);
      // The approved atlas allocation covers colour. The reviewed kit
      // carries up to two tiny 4×4 finish/emission maps alongside it.
      const finishBytes = textures.filter(t=>t.width===4 && t.height===4).length*84;
      assert(finishBytes <= 168 && nominal-finishBytes <= budget.texture_bytes,store.id+' '+tier);
      if (total.triangles > maxShop) { maxShop=total.triangles; largest=store.id; }
      maxCalls = Math.max(maxCalls,total.calls);
      triangles+=total.triangles; calls+=total.calls; bytes+=asset.bytes;
      anchorTriangles+=anchor.triangles; textureBytes+=nominal;
      perShop[store.id] = total.triangles;
    }
    assert(triangles <= plan.view_budget[title].sum_17_full_store_triangles);
    if (tier === 'low') assert(triangles <= plan.owner_caps.Low_global_added_triangles);
    summary.push({tier,triangles,calls,bytes,maxShop,largest,maxCalls,anchorTriangles,textureBytes,perShop});
  }
  t.diagnostic(JSON.stringify(summary));
});

function distanceToBox(point, box) {
  const dx = point[0]-box.center[0], dz = point[1]-box.center[2];
  const angle=radians(box.yaw), c=Math.cos(angle), s=Math.sin(angle);
  return Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-box.size[0]/2),
    Math.max(0,Math.abs(dx*s+dz*c)-box.size[2]/2));
}

test('new solid envelopes clear approved routes, seat exits, S01 pickups, and doors', () => {
  const seats = createSeatPlacements(true);
  for (const store of stores) {
    const {floor_surface_y_m,lot_width_depth_m:[w,d],actual_room_depth_m:depth} = store.frame;
    for (const box of store.colliders) {
      assert(box.size.every(value=>Number.isFinite(value) && value>0));
      assert(box.center[1]-box.size[1]/2 >= floor_surface_y_m-1e-7);
      const a=radians(box.yaw), c=Math.abs(Math.cos(a)), s=Math.abs(Math.sin(a));
      const hx=(box.size[0]*c+box.size[2]*s)/2, hz=(box.size[0]*s+box.size[2]*c)/2;
      assert(Math.abs(box.center[0])+hx < w/2,store.id);
      assert(box.center[2]+hz < d/2-.18 && box.center[2]-hz > d/2-depth,store.id);
      const spec = plans.get(store.id).clearance_check;
      const step = .005;
      for (const [start,end] of interiorRoutes(store)) {
        const n = Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])/step);
        for (let i=0;i<=n;i++) {
          const f=i/Math.max(1,n), point=start.map((value,j)=>value+(end[j]-value)*f);
          // Distance is 1-Lipschitz. The half-step allowance also covers
          // unsampled points between consecutive samples.
          assert(distanceToBox(point,box)+.003 >= spec.minimum_tested_centerline_to_envelope_m,store.id);
        }
      }
      for (const point of store.pickups) assert(distanceToBox(point,box) > .34);
      for (const {id,exit_local_m:exit,centre_local_m:center,radius} of store.frame.preserved_seats) {
        const live = seats.find(seat=>seat.id===id);
        const worldExit = worldInteriorBox(store,{center:[exit[0],0,exit[1]],size:[1,1,1],yaw:0}).center;
        assert.equal(round(worldExit[0]),round(live.exit.x));
        assert.equal(round(worldExit[2]),round(live.exit.z));
        for (let i=0;i<=20;i++) {
          const point = exit.map((value,j)=>value+(center[j]-value)*i/20);
          assert(distanceToBox(point,box)>radius,store.id+' '+id);
        }
      }
    }
    const finish = floorFinish(T,store), normals = finish.attributes.normal, points = finish.attributes.position;
    for (let i=0;i<normals.count;i++) {
      assert(normals.getY(i)>.99,store.id+' floor winding');
      assert.equal(round(points.getY(i)),round(floor_surface_y_m+.004));
      assert(Math.abs(points.getX(i)) < w/2 && points.getZ(i) < d/2-.18 && points.getZ(i) > d/2-depth);
    }
    finish.dispose();
  }
  assert.equal(plans.get('S01').clearance_check.margin_beyond_capsule_m,.04);
});

test('the rotated collider matches the Rapier cuboid', async t => {
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis,'fetch',async (url,options) =>
    String(url).endsWith('/rapier_bg.wasm') ? new Response(
      readFileSync(new URL('../vendor/rapier_bg.wasm',assets)),
      {headers:{'Content-Type':'application/wasm'}}
    ) : realFetch(url,options));
  await R.init();
  const physics = new R.World({x:0,y:-24,z:0});
  const {center:[x,y,z],size:[w,h,d],yaw} = worldInteriorBox(interiorStores.S15,interiorStores.S15.colliders[0]);
  const desc = R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z)
    .setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)});
  const collider = physics.createCollider(desc);
  const translation = collider.translation();
  assert(Math.hypot(translation.x-x,translation.y-y,translation.z-z) < 1e-5);
  assert.equal(round(collider.rotation().y),round(Math.sin(yaw/2)));
  physics.free();
});

function runBuild(work) {
  const iterator = work();
  let step;
  do { step = iterator.next(); } while (!step.done);
  return step.value;
}

test('warm registration installs all rooms, reprioritizes remaining work and commits tier changes together', async () => {
  const scene = new T.Scene(), requests = [], pending = [], colliders = [];
  const modelsByFile = new Map();
  let clock = 0;
  const runtime = createInteriorKit(T,scene,{
    now:()=>clock,
    registerCollider:box=>colliders.push(box),
    async loadModel({file}) {
      requests.push(file);
      const model = new T.Group();
      model.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));
      modelsByFile.set(file,model);
      return model;
    }
  });
  const createInstaller = () => ({
    build:runBuild,
    prepare: (roots,options) => new Promise(resolve => pending.push({roots,options,resolve})),
    runFrame: () => 0,
    dispose() {}
  });
  const go = (store,tier) => {
    const [x,y,z] = store.frame.world_origin_m;
    runtime.update({x,y,z});
    runtime.setTier(tier);
  };
  const frame = async () => {
    clock += 16;
    runtime.runFrame();
    await new Promise(resolve=>setImmediate(resolve));
    return pending.shift();
  };
  const complete = async upload => {
    upload.resolve();
    await Promise.resolve();
  };
  const finishAll = async remaining => {
    for (let i=0; i<remaining; i++) await complete(await frame());
  };

  assert.equal(colliders.length,stores.reduce((n,store)=>n+store.colliders.length,0));
  const store = interiorStores.S02;
  go(store,'low');
  assert.equal(await frame(),undefined);
  assert.deepEqual(requests,[]);
  const lowReady = runtime.prepare('low',createInstaller);
  const low = await frame();
  assert.equal(requests[0],store.files.low.file);
  const first = modelsByFile.get(requests[0]);
  assert(low.roots.includes(first));
  assert(!scene.getObjectById(first.id));
  assert.equal(runtime.report().preinstalled.shops,0);
  go(interiorStores.S17,'low');
  const second = await frame();
  assert.equal(requests[1],interiorStores.S17.files.low.file);
  assert(second.options.priority() < low.options.priority());
  await complete(second);
  await complete(low);
  assert.equal(runtime.report().preinstalled.shops,2);
  assert.equal(first.parent.visible,false);
  go(store,'low');
  assert(first.parent.visible);
  await finishAll(15);
  assert.deepEqual(await lowReady,{shops:17,ms:272});
  assert.equal(runtime.report().modelsLoaded,17);
  assert.equal(requests.length,17);
  go(interiorStores.S01,'low');
  assert.equal(await frame(),undefined);

  go(store,'balanced');
  const balanced = await frame();
  assert.equal(requests.at(-1),store.files.balanced.file);
  const upgraded = modelsByFile.get(requests.at(-1));
  assert(!scene.getObjectById(upgraded.id));
  await complete(balanced);
  assert.equal(runtime.report().tier,'low');
  assert(first.visible);
  assert(!upgraded.visible);
  await finishAll(16);
  assert.equal(runtime.report().tier,'balanced');
  assert(!first.visible);
  assert(upgraded.visible);
  assert.equal(runtime.report().modelsLoaded,34);

  go(store,'detailed');
  const detailed = await frame();
  assert(detailed.roots.includes(upgraded));
  assert.equal(requests.length,34);
  await complete(detailed);
  assert.equal(runtime.report().tier,'balanced');
  await finishAll(16);
  assert.equal(runtime.report().tier,'detailed');
  assert.equal(runtime.report().preinstalled.shops,17);
  assert.equal(runtime.report().modelsLoaded,42);

  go(store,'low');
  assert(first.visible);
  assert(!upgraded.visible);
  assert.equal(await frame(),undefined);
  runtime.beginFrame();
  const fakeRenderer = {info:{render:{calls:5,triangles:600}}};
  first.children[0].onBeforeRender(fakeRenderer);
  fakeRenderer.info.render.calls++;
  fakeRenderer.info.render.triangles+=12;
  first.children[0].onAfterRender(fakeRenderer);
  runtime.endFrame();
  assert.deepEqual(runtime.report(),{tier:'low',shops:1,drawCalls:1,triangles:12,modelsLoaded:42,
    bytes:manifest.assets.reduce((sum,asset)=>sum+asset.bytes,0),preinstalled:{shops:17,ms:0}});

  runtime.invalidate();
  go(store,'low');
  assert(!first.parent.visible);
  const restored = await frame();
  assert(restored.roots.includes(first));
  assert.equal(requests.length,42);
  await complete(restored);
  assert(first.parent.visible);
  runtime.dispose();
});

test('registration waits for the shared upload, all lighting variants and the GPU fence', async t => {
  const scene = new T.Scene(), accent = new T.PointLight(), fixed = new T.DirectionalLight();
  fixed.castShadow = true;
  scene.add(accent,fixed);
  const compiled = new Set();
  let target = null, uploadRelease, firstFence = false, deleted = 0;
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE:1, TIMEOUT_EXPIRED:2, CONDITION_SATISFIED:3, WAIT_FAILED:4,
    isContextLost:()=>false, flush() {},
    fenceSync:()=>({}), clientWaitSync:()=>firstFence ? 3 : 2, deleteSync() { deleted++; }
  };
  const renderer = {
    shadowMap:{enabled:false}, extensions:{has:()=>false}, getContext:()=>gl,
    getRenderTarget:()=>target, getActiveCubeFace:()=>0, getActiveMipmapLevel:()=>0,
    setRenderTarget(value) { target = value; },
    compile(geometry, camera, lighting) {
      if (geometry.children.some(root=>root.name.startsWith('S09 '))) {
        compiled.add([Boolean(target),this.shadowMap.enabled,lighting.children.length].join('/'));
      }
      return new Set();
    }
  };
  const runtime = createInteriorKit(T,scene,{
    registerCollider() {},
    prepareModel(roots,{linear,late}) {
      assert(linear());
      assert.equal(late,false);
      if (roots.some(root=>root.name.startsWith('S09 '))) return new Promise(resolve=>{ uploadRelease = resolve; });
      return Promise.resolve();
    },
    async loadModel() {
      const model = new T.Group();
      model.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));
      return model;
    }
  });
  t.after(()=>runtime.dispose());
  const [x,y,z] = interiorStores.S09.frame.world_origin_m;
  runtime.update({x,y,z});
  const done = registerInteriorWarmup(runtime,{T,renderer,scene,tier:'detailed',lights:{accents:[accent],limit:1}});
  const frame = async () => { runtime.runFrame(); await new Promise(resolve=>setImmediate(resolve)); };
  for (let i=0; i<12; i++) await frame();
  assert.deepEqual([...compiled].sort(),['false/false/1','false/false/2','true/true/1','true/true/2']);
  assert.equal(target,null);
  assert.equal(renderer.shadowMap.enabled,false);
  const room = scene.children.find(group=>group.name.startsWith('S09 '));
  assert.equal(room.visible,false);

  uploadRelease();
  for (let i=0; i<4; i++) await frame();
  assert.equal(room.visible,false);
  firstFence = true;
  for (let i=0; i<150; i++) await frame();
  assert.equal((await done).shops,17);
  assert.equal(deleted,17);
  assert(room.visible);
});

test('a timed-out warm stage continues nearest-first and publishes later tiers with their signs', async t => {
  const scene = new T.Scene(), files = [], visits = [];
  let now = 0, installedSigns = 'low', blockedSigns, failFile = interiorStores.S02.files.low.file;
  const interiors = createInteriorKit(T,scene,{
    now:()=>now, registerCollider() {},
    async loadModel({file}) {
      files.push(file);
      if (file === failFile) throw new Error('Unavailable fixture');
      return new T.Group();
    }
  });
  t.after(()=>interiors.dispose());
  // Control the upload completion independently of the scene and sign sweep.
  interiors.prepare('low',()=>({build:runBuild, prepare:async()=>{}, runFrame:()=>0, dispose(){}}),{deferActivation:true});
  const signage = {
    *prepareTier(tier) {
      while (blockedSigns === tier) yield false;
      return {tier,meshes:[]};
    },
    activeMeshes:()=>[], activate(stage) { installedSigns = stage.tier; }, discard() {}
  };
  const options = {
    T, renderer:{}, world:{scene,interiors,signage}, modelWarmup:{arrivalRevision:0,pendingMeshes:()=>[]},
    player:{camera:new T.PerspectiveCamera(),state:{x:0,y:1,z:0}}, expanded:true, atmosphere:{},
    applyProfile({tier}) { visits.push([tier,interiors.activeTier,installedSigns]); }
  };
  const work = tier => prepareTier(options,{tier,shadows:false},createWarmReport());
  function move(store) {
    const [x,y,z] = store.frame.world_origin_m;
    interiors.update({x,y,z});
  }
  async function frame() {
    interiors.runFrame();
    await new Promise(resolve=>setImmediate(resolve));
  }
  const report = createWarmReport();
  const low = createWarmRunner(work('low'),report,{
    budgetMs:8, now:()=>now, setTimer(){}, clearTimer(){}, lost:()=>false, onFinish(){}
  });
  move(interiorStores.S02);
  low.runFrame();
  await frame();
  assert.equal(files[0],failFile);
  now = 6000;
  low.runFrame();
  assert.equal(report.reason,'timeout');
  move(interiorStores.S17);
  assert.equal(report.background,'running');
  for (let i=0; i<16; i++) await frame();
  assert.equal(files[1],interiorStores.S17.files.low.file);
  assert.equal(interiors.report().preinstalled.shops,16);
  low.runFrame();
  assert.deepEqual(visits,[]);
  failFile = null;
  now += 15000;
  await frame();
  assert.equal(interiors.report().preinstalled.shops,17);
  low.runFrame();
  assert.equal(report.background,'complete');
  assert.deepEqual(visits,[['low','low','low']]);

  blockedSigns = 'balanced';
  const balanced = work('balanced');
  for (let i=0; i<17; i++) await frame();
  assert.equal(interiors.report().preinstalled.shops,17);
  assert.equal(balanced.next().value,false);
  assert.equal(interiors.activeTier,'low');
  balanced.return();
  const detailed = work('detailed');
  for (let i=0; i<16; i++) await frame();
  for (let i=0; i<30; i++) assert.equal(detailed.next().done,false);
  assert.equal(installedSigns,'low');
  assert.equal(interiors.activeTier,'low');
  await frame();
  assert.equal(detailed.next().done,true);
  assert.deepEqual(visits,[['low','low','low'],['detailed','detailed','detailed']]);
});

test('studio substitution retains the exact authored collision boxes', async t => {
  globalThis.window = {requestIdleCallback() {}};
  globalThis.document = {addEventListener() {}};
  t.after(()=>{ delete globalThis.window; delete globalThis.document; });
  const studio = await createExpandedInteriors(T,expandedLayout,new T.Scene());
  // Baseline generated with the studio builders at 6a14b41d.
  assert.equal(studio.collisionBoxes.length,187);
  assert.equal(sha(JSON.stringify(studio.collisionBoxes)),
    'db700aaf6838349f451e011ffd4945ec973d3ccbbc4b116e37a67b4e3ccfd47b');
});
