import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {loadFoodCourt} from '../demos/corporate/gjh/v11/assets/food-court.js';
import {createFoodCourtApproach} from '../demos/corporate/gjh/v11/assets/food-court-approach.js';
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


function visitorCanvas(t) {
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
  return canvas;
}

test('the normal chase camera sees the visitor through the real void-deck transfer beams',async t => {
  const canvas=visitorCanvas(t);
  const scene=new T.Scene(), world=new R.World({x:0,y:-24,z:0}), cameraBounds=[];
  const chunk=await loadSingaporeStreet(T,new AbortController().signal,{base,read});
  chunk.mount(scene,R,world,cameraBounds);
  const player=await createPlayer(T,R,world,scene,canvas,new T.MeshBasicMaterial(),new T.PlaneGeometry(),[],cameraBounds,true);
  assert.equal(player.state.character.model,'gjh-tripo-visitor');
  const ceilings=cameraBounds.filter(box=>box.streetCeiling);
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

test('four authored dining chairs share ordinary sit, stand and exact generation cleanup',async t=>{
  const canvas=visitorCanvas(t), scene=new T.Scene(), physics=new R.World({x:0,y:-24,z:0});
  const cBase=new URL('../food-court/',base), cameraBounds=[], seats=[], observed=[];
  const floor=physics.createCollider(R.ColliderDesc.cuboid(22,.1,21).setTranslation(12,-.12,75));
  const installSeat=seat=>{
    seats.push(seat);
    return ()=>{assert.ok(physics.getCollider(seat.collider)); seats.splice(seats.indexOf(seat),1);};
  };
  const readModel=async url=>{observed.push(url.pathname.split('/').at(-1));return read(url);};
  const court=await loadFoodCourt({T,R,physics,scene,cameraBounds,installSeat,read:readModel,base:cBase},new AbortController().signal);
  assert.deepEqual(observed,['sources.json','hawker-stall.glb','chicken-rice-stall.glb','restaurant-table-chair-set.glb','kopitiam-kettle.glb']);
  assert.equal(court.safeToMount(21,91.9),false,'never seal a visitor into a service stall');
  assert.equal(court.safeToMount(27.1,86.8),false,'no new collider may appear around the visitor');
  assert.equal(court.safeToMount(22.8,86.2),true);
  court.mount();court.mount();physics.step();
  const mesh=scene.getObjectByName('Singapore food court');
  assert.equal(court.counts.models,4);
  assert.equal(seats.length,4);
  assert.ok(seats.find(s=>s.id.endsWith('south')).z>seats.find(s=>s.id.endsWith('north')).z);
  assert.ok(court.counts.geometries<=26 && court.counts.materials<=26,JSON.stringify(court.counts));
  assert.ok(mesh.children.some(n=>n.material.transparent && Math.abs(n.material.opacity-.18)<.01),'original chicken display glass');
  const player=await createPlayer(T,R,physics,scene,canvas,new T.MeshBasicMaterial(),new T.PlaneGeometry(),seats,cameraBounds,true);
  function position(x,z,y=.855){
    const p={x,y,z};player.body.setTranslation(p,true);player.body.setNextKinematicTranslation(p);
    physics.step();player.resetInterpolation();
  }
  const frame=()=>{player.update(1/60);physics.step();};
  assert.equal(player.state.character.model,'gjh-tripo-visitor');
  const disposal={geometries:0,materials:0};
  for(const m of mesh.children){
    m.geometry.addEventListener('dispose',()=>disposal.geometries++);
    m.material.addEventListener('dispose',()=>disposal.materials++);
  }
  for(const seat of seats){
    assert.ok(seat.modelVisible());
    position(seat.exitX,seat.exitZ);
    assert.equal(player.sit(seat.id),true,seat.id+' is reachable through the aisle');
    for(let i=0;i<80;i++)frame();
    assert.equal(player.state.seatId,seat.id);assert.equal(player.state.seatPhase,'seated');
    assert.ok(Math.abs(seat.y-.43)<.001);
    const cushion=new T.Raycaster(new T.Vector3(seat.x,.55,seat.z),new T.Vector3(0,-1,0),0,.19).intersectObject(mesh,true);
    assert.ok(cushion.some(hit=>Math.abs(hit.point.y-seat.y)<.015),'actual seat top '+seat.id);
    assert.equal(player.stand(),true);for(let i=0;i<65;i++)frame();
    assert.equal(player.state.capsuleEnabled,true);
    assert.ok(Math.hypot(player.state.x-seat.exitX,player.state.z-seat.exitZ)<.09,seat.id+' standing clearance');
  }
  // A real south-chair Stand previously put the 390 camera inside the poultry display.
  const south=seats.find(s=>s.id.endsWith('south'));
  position(south.exitX,south.exitZ);
  player.setInput({yaw:0,pitch:.1});player.updateCamera(0,true);
  const priorEye=new T.Vector3(27.1000058,1.751529,93.2763784);
  for(const h of [1,1.45,1.68]){
    const target=new T.Vector3(south.exitX,-.02+h,south.exitZ);
    const rayFrom=eye=>{const d=target.clone().sub(eye);return new T.Raycaster(eye,d.clone().normalize(),0,d.length()-.015)
      .intersectObject(mesh,true).filter(hit=>hit.object.material.opacity>.5);};
    if(h<1.68)assert.ok(rayFrom(priorEye).some(hit=>hit.object.material.name==='Poached chicken'));
    assert.equal(rayFrom(player.camera.position).length,0,'the display leaves the returned visitor visible');
  }
  position(23.1,86.2);
  for(const yaw of [0,Math.PI/2+1e-6,Math.PI]){
    player.setInput({yaw,pitch:.1});player.updateCamera(0,true);
    for(const h of [.10,1,1.70]){
      const eye=player.camera.position,target=new T.Vector3(23.1,h,86.2),d=target.sub(eye);
      const hits=new T.Raycaster(eye,d.clone().normalize(),0,d.length()-.02).intersectObject(mesh,true);
      assert.equal(hits.length,0,'roof and posts keep the ordinary visitor visible');
    }
  }
  player.setInput({yaw:0,pitch:1});player.updateCamera(0,true);
  assert.ok(player.camera.position.y<4.13,'the orbit cannot emerge through the canopy');
  assert.equal(physics.castRay(new R.Ray({x:10,y:.8,z:83.4},{x:1,y:0,z:0}),20,true),null,'east entrance aisle');
  const counts=court.counts;court.dispose();court.dispose();
  assert.deepEqual(disposal,{geometries:counts.geometries,materials:counts.materials});
  assert.equal(seats.length,0);assert.equal(cameraBounds.length,0);assert.ok(!scene.getObjectByName('Singapore food court'));
  assert.ok(physics.getCollider(floor.handle));assert.equal(physics.colliders.len(),2,'floor and player remain');
  player.dispose();physics.free();
});

test('food court streams on approach, holds a safe staging point and leaves the underlying street usable on failure',async()=>{
  const pending=[],events=[];
  const stage=createFoodCourtApproach({},(_options,signal)=>new Promise((resolve,reject)=>pending.push({resolve,reject,signal})));
  const prepared=()=>({safeToMount:(x,z)=>x!==27,mount(){events.push('mount');},dispose(){events.push('dispose');},counts:{seats:4}});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  for(const z of [45,50.5,65.5]) stage.update(10,z);
  assert.equal(pending.length,0,'no extra models needed at the mall or first street block');
  stage.update(12,79);pending[0].reject(new Error('offline'));await tick();stage.update(21,87);
  assert.equal(stage.state.status,'unavailable');assert.equal(stage.contains(21,87),false);
  stage.update(10,64);stage.update(12,79);assert.equal(pending.length,2);
  stage.update(10,64);assert.ok(pending[1].signal.aborted);
  pending[1].resolve(prepared());await tick();assert.deepEqual(events,['dispose']);
  stage.update(12,79);pending[2].resolve(prepared());await tick();stage.update(27,87);
  assert.equal(stage.state.status,'staged');stage.update(21,87);
  assert.deepEqual(stage.state,{status:'ready',seats:4});assert.equal(stage.contains(21,87),true);
  assert.equal(stage.notice,'');
  stage.update(10,85);assert.equal(stage.notice,'Food court beside the last row of shophouses.');
  stage.update(10,74);assert.equal(stage.notice,'');
  stage.update(10,62);assert.equal(stage.state.status,'distant');assert.deepEqual(events,['dispose','mount','dispose']);
  stage.update(21,87);stage.dispose();pending[3].resolve(prepared());await tick();
  assert.equal(stage.state.status,'distant');assert.deepEqual(events,['dispose','mount','dispose','dispose']);
});

test('the optional court fails before network access if the browser cannot verify its receipts',async t=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});
  t.after(()=>Object.defineProperty(globalThis,'crypto',original));
  let fetches=0;
  await assert.rejects(loadFoodCourt({T,read:()=>{fetches++;}},new AbortController().signal),/integrity verification unavailable/);
  assert.equal(fetches,0);
});

test('tampered optional stall bytes never mount',async()=>{
  const cBase=new URL('../food-court/',base),scene=new T.Scene(),physics=new R.World({x:0,y:-24,z:0}),cameraBounds=[];
  const corrupt=async url=>{
    const bytes=readFileSync(url);if(url.pathname.endsWith('chicken-rice-stall.glb'))bytes[bytes.length-1]^=1;
    return new Response(bytes);
  };
  await assert.rejects(loadFoodCourt({T,R,physics,scene,cameraBounds,read:corrupt,base:cBase},new AbortController().signal),/changed/);
  assert.equal(scene.children.length,0);assert.equal(physics.colliders.len(),0);assert.equal(cameraBounds.length,0);physics.free();
});

test('real parent street remains walkable after a stall failure and retires its in-flight retry',async()=>{
  const scene=new T.Scene(),physics=new R.World({x:0,y:-24,z:0}),cameraBounds=[],seats=[];
  let retry,lateSignal,optionalRequests=0;
  const readLayer=async(url,options)=>{
    if (!url.pathname.endsWith('/food-court/chicken-rice-stall.glb')) return read(url);
    optionalRequests++;
    if (optionalRequests===1) return new Response(null,{status:503});
    lateSignal=options.signal;
    return new Promise(resolve=>{retry=()=>resolve(read(url));});
  };
  const chunk=await loadSingaporeStreet(T,new AbortController().signal,{base,read:readLayer});
  const installSeat=seat=>{seats.push(seat);return ()=>seats.splice(seats.indexOf(seat),1);};
  chunk.mount(scene,R,physics,cameraBounds,installSeat);
  const baseline=chunk.counts;
  async function until(condition){
    for(let i=0;i<500 && !condition();i++) await new Promise(resolve=>setTimeout(resolve,2));
    assert.ok(condition(),'the optional request settled');
  }
  chunk.update(10,65,'low');
  assert.equal(chunk.foodCourt.state.status,'distant');assert.equal(optionalRequests,0);
  chunk.update(10,85,'low');await until(()=>chunk.foodCourt.state.status==='unavailable');
  physics.step();
  assert.equal(chunk.counts.colliders,baseline.colliders);assert.equal(cameraBounds.length,baseline.cameraBounds);
  assert.ok(scene.children.includes(chunk.group));assert.equal(seats.length,0);
  assert.equal(physics.castRay(new R.Ray({x:10,y:.85,z:48.2},{x:0,y:0,z:1}),39,true),null);
  assert.ok(physics.castRay(new R.Ray({x:23,y:1,z:86},{x:0,y:-1,z:0}),1.1,true),'the base parcel is still walkable');
  chunk.update(10,65,'low');chunk.update(10,85,'low');await until(()=>Boolean(retry));
  const outgoing=chunk.foodCourt;
  chunk.dispose(physics);
  assert.ok(lateSignal.aborted);retry();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(optionalRequests,2);assert.equal(outgoing.state.status,'distant');
  assert.equal(scene.children.length,0);assert.equal(cameraBounds.length,0);assert.equal(physics.colliders.len(),0);assert.equal(seats.length,0);
  physics.free();
});
