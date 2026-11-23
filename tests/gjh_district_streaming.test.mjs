import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createPlayer} from '../demos/corporate/gjh/v11/assets/player.js';
import {limitCameraByObstacles} from '../demos/corporate/gjh/v11/assets/camera-controller.js';
import {createDistrictGateway} from '../demos/corporate/gjh/v11/assets/district-gateway.js';
import {loadSingaporeStreet} from '../demos/corporate/gjh/v11/assets/street-chunk.js';

const assets = new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
const base = new URL('districts/singapore/',assets);
const read = async url => new Response(readFileSync(url));
await R.init(readFileSync(new URL('../vendor/rapier_bg.wasm',assets)));

test('originals form an open footpath and release all owned Rapier handles and GPU bindings',async () => {
  const scene = new T.Scene(), world = new R.World({x:0,y:-24,z:0});
  const chunk = await loadSingaporeStreet(T,new AbortController().signal,{base,read});
  const mallCameraBox = new T.Box3(), cameraBounds = [mallCameraBox];
  chunk.mount(scene,R,world,cameraBounds);
  assert.ok(chunk.counts.cameraBounds >= 20);
  const ownedCameraBounds = cameraBounds.slice(1);
  assert.ok(ownedCameraBounds.every(box => !box.isEmpty() && [...box.min,...box.max].every(Number.isFinite)));
  // Real drags generally end very close to a compass heading, not at exact zero.
  for (const z of [45,50.8,65.5]) {
    const origin = new T.Vector3(10,2.87,z);
    for (const yaw of [Math.PI+3e-7,Math.PI/2+3e-7,-Math.PI/2+3e-7,Math.PI/4]) {
      const direction = new T.Vector3(Math.sin(yaw)*Math.cos(.1),Math.sin(.1),Math.cos(yaw)*Math.cos(.1));
      assert.ok(limitCameraByObstacles(origin,direction,5,.22,ownedCameraBounds)>1.5,'clear third-person view at '+z+', '+yaw);
    }
  }
  const realCrown=ownedCameraBounds.find(b=>b.min.y>3 && b.min.z>48 && b.min.z<54 && b.min.x>10);
  assert.ok(realCrown);
  const below=realCrown.getCenter(new T.Vector3()); below.y=realCrown.min.y-1.4;
  const clearance=limitCameraByObstacles(below,new T.Vector3(0,1,0),5,.22,ownedCameraBounds);
  assert.ok(clearance>0 && clearance<1.4,'solid canopy still constrains an upward camera');
  assert.equal(chunk.counts.models,5);
  assert.ok(chunk.counts.geometries <= 40 && chunk.counts.materials <= 16,JSON.stringify(chunk.counts));
  chunk.update(10,66,'low');
  const low = chunk.counts.visibleLod;
  chunk.update(10,66,'detailed');
  assert.ok(low > 0 && low < chunk.counts.visibleLod && chunk.counts.visibleLod <= chunk.counts.lodGroups);
  assert.ok(chunk.counts.colliders > 65,JSON.stringify(chunk.counts));
  const events = {geometry:0,material:0};
  for (const mesh of chunk.group.children) mesh.geometry.addEventListener('dispose',()=>events.geometry++);
  for (const material of new Set(chunk.group.children.map(m=>m.material))) material.addEventListener('dispose',()=>events.material++);
  world.step();
  for (const z of [48.02,49.5,55,60,65,75,83.5]) {
    const ground = world.castRay(new R.Ray({x:10,y:1,z},{x:0,y:-1,z:0}),3,true);
    assert.ok(ground && Math.abs(ground.timeOfImpact-1.02)<.06,'ground at '+z);
  }
  const passage = world.castRay(new R.Ray({x:10,y:.9,z:48.1},{x:0,y:0,z:1}),35,true);
  assert.equal(passage,null,'step-free central path to the end of the street');
  const facade = world.castRay(new R.Ray({x:10,y:1.4,z:54},{x:1,y:0,z:0}),22,true);
  assert.ok(facade && facade.timeOfImpact<20,'physical frontage');
  const {geometries,materials} = chunk.counts;
  chunk.dispose(world);
  assert.deepEqual(events,{geometry:geometries,material:materials});
  assert.equal(world.colliders.len(),0);
  assert.equal(scene.children.length,0);
  assert.deepEqual(cameraBounds,[mallCameraBox]);
  world.free();
});

test('a failed or late district never opens the gate; walking back releases the street',async () => {
  const scene = new T.Scene(), physics = new R.World({x:0,y:0,z:0});
  const loads = [], changes = [], notices = [];
  const gateway = createDistrictGateway({T,R,scene,physics,setMallDetail:v=>changes.push(v),notice:v=>notices.push(v),
    load:() => new Promise((resolve,reject) => loads.push({resolve,reject}))});
  const walk = z => gateway.update({x:10,y:0,z});
  const tick = () => new Promise(resolve=>setImmediate(resolve));
  let disposed = 0;
  const lease = () => ({mount(){},dispose(){disposed++;},models:['test'],counts:{models:1}});
  walk(45);
  assert.equal(loads.length,0);
  walk(47); loads[0].reject(new Error('Offline')); await tick();
  assert.equal(gateway.state.status,'unavailable');
  assert.equal(physics.colliders.getAll()[0].isEnabled(),true);
  walk(44); walk(47); walk(40); loads[1].resolve(lease()); await tick();
  assert.equal(disposed,1);
  assert.equal(gateway.state.status,'mall');
  walk(47); loads[2].resolve(lease()); await tick();
  for (let i=0;i<15;i++) walk(47);
  assert.equal(physics.colliders.getAll()[0].isEnabled(),false);
  for (const z of [49.4,59,60,57,53,51,48.7,46,41]) walk(z);
  assert.deepEqual(changes,[false,true]);
  assert.equal(disposed,2);
  assert.equal(gateway.state.street.colliders,0);
  assert.equal(physics.colliders.getAll()[0].isEnabled(),true);
  gateway.dispose();
  assert.equal(physics.colliders.len(),0);
  physics.free();
});

test('missing, truncated and altered originals cannot mount',async () => {
  for (const issue of ['missing','truncated','corrupt']) {
    const readBad = async url => {
      if (!String(url).endsWith('hdb-block.glb')) return read(url);
      const bytes = readFileSync(url);
      if (issue==='missing') return new Response(null,{status:404});
      if (issue==='truncated') return new Response(bytes.subarray(0,100));
      bytes[bytes.length-1]^=1;
      return new Response(bytes);
    };
    await assert.rejects(loadSingaporeStreet(T,new AbortController().signal,{base,read:readBad}));
  }
});


test('the normal chase camera sees the visitor through the real void-deck transfer beams',async t => {
  const noop=()=>{}, canvas={clientWidth:390,clientHeight:796,dataset:{},style:{},
    classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,removeEventListener:noop,setAttribute:noop};
  canvas.querySelector=()=>canvas;
  const environment={location:{search:''},window:{performance,matchMedia:()=>({matches:false}),addEventListener:noop},
    document:canvas,matchMedia:()=>({matches:false}),self:globalThis,
    ProgressEvent:globalThis.ProgressEvent??class extends Event{},createImageBitmap:async()=>({width:1,height:1}),
    fetch:async input=>{const url=new URL(input.url??input);
      if(url.protocol!=='file:')return new Response(null,{status:404});
      try{return new Response(readFileSync(url));}catch{return new Response(null,{status:404});}}
  };
  const old=new Map(Object.keys(environment).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  Object.assign(globalThis,environment);
  t.after(()=>{for(const [k,description] of old){if(description)Object.defineProperty(globalThis,k,description);else delete globalThis[k];}});
  const scene=new T.Scene(), world=new R.World({x:0,y:-24,z:0}), cameraBounds=[];
  const chunk=await loadSingaporeStreet(T,new AbortController().signal,{base,read});
  chunk.mount(scene,R,world,cameraBounds);
  const player=await createPlayer(T,R,world,scene,canvas,new T.MeshBasicMaterial(),new T.PlaneGeometry(),[],cameraBounds,true);
  assert.equal(player.state.character.model,'gjh-tripo-visitor');
  const ceilings=cameraBounds.filter(box=>box.voidDeckCeiling);
  assert.equal(ceilings.length,6,'four separately authored slab areas and two transfer beams');
  for(const [width,height,x,z,oldEye] of [
    [390,796,-9.201,52.351,[-4.223,3.389,52.351]],
    [1440,852,-9.207,52.387,[-4.031,3.409,52.387]]]){
    const position={x,y:.875,z};
    player.body.setTranslation(position,true);player.body.setNextKinematicTranslation(position);
    world.step();player.resetInterpolation();player.resizeCamera(width,height);
    player.setInput({yaw:Math.PI/2+3e-7,pitch:.1});player.updateCamera(0,true);
    const eye=player.camera.position;
    assert.ok(Math.hypot(eye.x-x,eye.z-z)>2.5,JSON.stringify({eye,position}));
    for(const marker of [.06,1,1.65]){
      const target=new T.Vector3(x,marker,z);
      function hits(origin){const delta=target.clone().sub(origin);return new T.Raycaster(origin,delta.clone().normalize(),0,delta.length()-.01).intersectObject(chunk.group,true);}
      if(marker===1.65 || width===390&&marker===1)assert.ok(hits(new T.Vector3(...oldEye)).length,'the previous normal camera saw a solid beam at '+width+'/'+marker);
      assert.equal(hits(eye).length,0,'unobstructed visitor landmark '+marker+' at '+width);
    }
    // The precise ceiling also stops a high orbit from passing through its underside.
    player.setInput({yaw:Math.PI/2,pitch:1});player.updateCamera(0,true);
    assert.ok(player.camera.position.y < 3.18,JSON.stringify(player.camera.position));
  }
  player.dispose();chunk.dispose(world);world.free();
});
