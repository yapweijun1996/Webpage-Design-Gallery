import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {createInteriorModelLoader} from '../demos/corporate/gjh/v11/assets/interiors/models.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createExpandedInteriors} from '../demos/corporate/gjh/v11/assets/expanded-interiors.js';
import {expandedLayout} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {isInFrontOfSeat} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {createGrandBenchMount,measureGrandPiano} from '../demos/corporate/gjh/v11/assets/interiors/casio-grand-seat.js';
import {createInteriorKit} from '../demos/corporate/gjh/v11/assets/interiors/runtime.js';
import {interiorAsset,interiorStores,worldInteriorBox} from '../demos/corporate/gjh/v11/assets/interiors/config.js';

const assets = new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
const store = interiorStores.S15;
function localFiles(t){
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis,'fetch',(req,o)=>{
    const url = new URL(req.url??req);
    return url.protocol==='file:' ? Promise.resolve(new Response(readFileSync(url),{headers:{'Content-Type':url.pathname.endsWith('.wasm')?'application/wasm':'application/octet-stream'}})) : originalFetch(req,o);
  });
  globalThis.self=globalThis;
  globalThis.createImageBitmap=async()=>({width:1,height:1});
  t.after(()=>{delete globalThis.self;delete globalThis.createImageBitmap;});
}

test('the installed Low and Balanced piano batches retain their visible bench and body parts',async t=>{
  localFiles(t);
  const load=createInteriorModelLoader(T,assets,new GLTFLoader(),()=>'low'), signal=new AbortController().signal;
  for(const tier of ['low','balanced']){
    const model=await load(interiorAsset(store,tier),signal);
    const piano=model.userData.grandPiano;
    assert(piano,'the visible Bench is lost during the current material merge');
    assert.equal(piano.guards.length,3);
    assert(model.children[piano.drawIndex]?.isMesh);
    assert.equal(model.children.length,1,'keep the published single piano submission');
    assert(Math.abs(piano.bench.max.y-.644989)<1e-6);
  }
});

test('an absent, hidden, altered or empty source part cannot publish a native piano bench',async t=>{
  localFiles(t);
  const file=interiorAsset(store,'low').file;
  const {scene}=await new GLTFLoader().parseAsync(Uint8Array.from(readFileSync(new URL('interiors/'+file,assets))).buffer,'');
  assert(measureGrandPiano(T,scene));
  for(const name of ['Bench','Case_and_action','Keyboard_and_music_rest','Raised_lid']){
    const node=scene.getObjectByName(name),parent=node.parent;
    node.visible=false;assert.equal(measureGrandPiano(T,scene),null,name);node.visible=true;
    parent.remove(node);assert.equal(measureGrandPiano(T,scene),null,name);parent.add(node);
  }
  const bench=scene.getObjectByName('Bench');
  const extra=bench.clone();scene.add(extra);assert.equal(measureGrandPiano(T,scene),null);scene.remove(extra);
  bench.geometry=new T.BufferGeometry();
  assert.equal(measureGrandPiano(T,scene),null);
});

test('only the seat transition crosses coarse piano proxies and every displayed instrument part stays solid',async t=>{
  localFiles(t);
  globalThis.window={requestIdleCallback(){}};
  globalThis.document={addEventListener(){}};
  t.after(()=>{delete globalThis.window;delete globalThis.document;});
  await R.init();
  const scene=new T.Scene(), studio=await createExpandedInteriors(T,expandedLayout,scene);
  const physics=new R.World({x:0,y:0,z:0});
  t.after(()=>physics.free());
  const add=({center:[x,y,z],size:[w,h,d],yaw=0})=>physics.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2)
    .setTranslation(x,y,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));
  let piano,cabinet;
  for(const b of studio.collisionBoxes){
    const shape=add({center:[b.x,b.y,b.z],size:[b.width,b.height,b.depth]});
    if(b===studio.grandCabinetBox){assert(b.replacedDisplay);assert.equal(b.x,40.49);cabinet=shape;}
  }
  for(const footprint of store.colliders){
    const shape=add(worldInteriorBox(store,footprint));
    if(footprint.grandPiano)piano=shape;
  }
  const load=createInteriorModelLoader(T,assets,new GLTFLoader(),()=>'low');
  const low=await load(interiorAsset(store,'low')), balanced=await load(interiorAsset(store,'balanced'));
  scene.add(low,balanced);
  const guards=[],seats=[];
  const activate=createGrandBenchMount(T,store,spec=>{
    const guard=add(spec);guards.push(guard);
    return ()=>{guards.splice(guards.indexOf(guard),1);physics.removeCollider(guard,false);};
  },seat=>{seats.push(seat);return ()=>seats.splice(seats.indexOf(seat),1);});
  activate(low,piano.handle,undefined);assert.equal(seats.length,0);
  activate(low,piano.handle,cabinet.handle);
  physics.step();
  const [seat]=seats;
  assert.equal(seats.length,1);assert.equal(guards.length,3);assert.equal(seat.collider,piano.handle);
  assert.equal(seat.cabinetCollider,cabinet.handle);
  for(const [v,e] of [[seat.x,39.875747],[seat.y,.725989],[seat.z,26.648757],
    [seat.floor,.081],[seat.exitX,38.821773],[seat.exitZ,27.298094]])assert(Math.abs(v-e)<.00001);
  assert(isInFrontOfSeat(seat,seat.exit));
  assert(!isInFrontOfSeat(seat,{x:2*seat.x-seat.exitX,z:2*seat.z-seat.exitZ}));
  const capsule=new R.Capsule(.55,.30),rotation={x:0,y:0,z:0,w:1};
  const standing=new T.Vector3(seat.exitX,seat.floor+.91,seat.exitZ),target=new T.Vector3(seat.x,seat.floor+.89,seat.z);
  const hit=(point,filter)=>physics.intersectionWithShape(point,rotation,capsule,undefined,undefined,undefined,undefined,filter);
  assert.equal(hit(standing),null);
  for(const box of [piano,cabinet])assert.equal(hit(target,c=>c.handle===box.handle).handle,box.handle);
  const realSolids=c=>c.handle!==seat.collider && c.handle!==seat.cabinetCollider;
  for(let i=0;i<=28;i++)assert.equal(hit(standing.clone().lerp(target,i/28),realSolids),null);
  for(const guard of guards){
    assert.equal(hit(guard.translation(),c=>c.handle===guard.handle).handle,guard.handle);
    // Every added guard is inside the released walking envelope in the piano's own axes.
    const relative=new T.Vector3().subVectors(guard.translation(),piano.translation());
    relative.applyQuaternion(new T.Quaternion().copy(piano.rotation()).invert());
    const half=guard.halfExtents(),outer=piano.halfExtents();
    for(const axis of ['x','y','z'])assert(Math.abs(relative[axis])+half[axis]<=outer[axis]+.00001);
  }
  const savedGuards=guards.map(g=>g.handle);
  activate(balanced,piano.handle,cabinet.handle);
  assert.equal(seats[0],seat);
  assert.equal(guards.length,3);
  assert.notDeepEqual(guards.map(g=>g.handle),savedGuards,'Balanced has a slightly deeper keyboard/rest solid');
  assert(Math.abs(guards[1].halfExtents().y*2-balanced.userData.grandPiano.guards[1].getSize(new T.Vector3()).y)<1e-6);
  const balancedGuards=guards.map(g=>g.handle);
  activate(balanced,piano.handle,cabinet.handle);
  assert.deepEqual(guards.map(g=>g.handle),balancedGuards);
  assert(seat.modelVisible());balanced.children[0].visible=false;assert(!seat.modelVisible());
  balanced.children[0].visible=true;assert(seat.modelVisible());
  const invalid=new T.Group();scene.add(invalid);activate(invalid,piano.handle,cabinet.handle);
  assert.equal(seats.length+guards.length,0);assert(!seat.modelVisible());
  assert(physics.getCollider(piano.handle) && physics.getCollider(cabinet.handle));
  activate(low,piano.handle,cabinet.handle);
  assert(!seat.modelVisible(),'retired handles cannot reactivate a stale interaction reference');
  activate(null);activate(null);
  assert.equal(seats.length+guards.length,0);
});

test('installation publishes only the shown complete piano and withdraws its seat before collider teardown',async t=>{
  localFiles(t);
  const scene=new T.Scene(), loader=createInteriorModelLoader(T,assets,new GLTFLoader(),()=>'low');
  const get=(tier)=>loader(interiorAsset(store,tier));
  const low=await get('low'), invalid=new T.Group();
  let now=0, failure=true, active,shapes=0;
  const history=[];
  const kit=createInteriorKit(T,scene,{
    now:()=>now,
    registerCollider(_spec,_store,b){
      if(b.grandPiano)shapes++;
      return ()=>{if(b.grandPiano){assert(!active);shapes--;}};
    },
    async loadModel(asset){
      if(asset.file===store.files.low.file){
        if(failure)throw Error('404');
        return low;
      }
      return asset.file===store.files.balanced.file ? invalid : new T.Group();
    },
    showGrandBench(model){
      if(model){assert.equal(shapes,1);assert(model.parent && model.visible);}
      active=model;history.push(model);
    }
  });
  const installer=()=>({build(work){const iterator=work();let step;do{step=iterator.next();}while(!step.done);return step.value;},
    prepare:async()=>{},runFrame:()=>0,dispose(){}});
  const pump=async until=>{
    for(let i=0;i<300&&!until();i++){kit.runFrame();await new Promise(r=>setImmediate(r));}
    assert(until());
  };
  const prepared=kit.prepare('low',installer);
  await pump(()=>kit.report().preinstalled.shops===16);
  assert(!active);assert.equal(shapes,0);
  failure=false;now=16000;
  await pump(()=>kit.activeTier==='low');await prepared;
  assert.equal(active,low);
  const staged=kit.prepare('balanced',installer,{deferActivation:true});
  await pump(()=>kit.report().preinstalled.shops===17);await staged;
  assert.equal(active,low,'preparing an unshown model must not retire the current seat');
  assert(kit.activateTier('balanced'));assert(!active);
  assert.equal(shapes,1,'walking collider survives a model with no visible Bench');
  await kit.prepare('low',installer);assert.equal(active,low);
  kit.invalidate();assert(!active);assert.equal(shapes,0);
  assert(history.includes(low));
  kit.dispose();
});
