import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {createInteriorModelLoader} from '../demos/corporate/gjh/v11/assets/interiors/models.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createExpandedInteriors} from '../demos/corporate/gjh/v11/assets/expanded-interiors.js';
import {casioStorefrontPiano} from '../demos/corporate/gjh/v11/assets/gallery-east-shops.js';
import {expandedLayout} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {isInFrontOfSeat} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {createGrandBenchMount,createStorefrontBenchMount,measureGrandPiano,measureStorefrontPiano} from '../demos/corporate/gjh/v11/assets/interiors/casio-grand-seat.js';
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

test('the storefront grand has a separate visible four-legged bench in its original material batch', async t=>{
  localFiles(t);
  const bytes=readFileSync(new URL(casioStorefrontPiano.file,assets));
  const {scene}=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
  const profile=measureStorefrontPiano(T,scene);
  assert(profile);
  const fixed=point=>point.toArray().map(value=>+value.toFixed(5));
  assert.deepEqual(fixed(profile.bench.min),[-.33,0,.8125]);
  assert.deepEqual(fixed(profile.bench.max),[.33,.55,1.1725]);
  assert.deepEqual(fixed(profile.guards[0].max),[.75,1.81186,.5775]);
  const lacquer=scene.getObjectByName('MESH_Black_lacquer');
  lacquer.visible=false;assert.equal(measureStorefrontPiano(T,scene),null);
  lacquer.visible=true;
  lacquer.material.opacity=0;assert.equal(measureStorefrontPiano(T,scene),null);lacquer.material.opacity=1;
  // Keep the original piano and its drawing material, but remove the four-legged bench.
  const instrument=lacquer.geometry.clone(), position=instrument.getAttribute('position');
  const vertex=new T.Vector3(), original=instrument.getIndex(), indices=[];
  for(let i=0;i<original.count;i+=3){
    const tri=[0,1,2].map(j=>original.getX(i+j));
    if(tri.every(v=>vertex.fromBufferAttribute(position,v).applyMatrix4(lacquer.matrixWorld).z<.7))
      indices.push(...tri);
  }
  instrument.setIndex(indices);
  lacquer.geometry=instrument;
  assert.equal(measureStorefrontPiano(T,scene),null);
});

test('Casio storefront bench mounts after real gallery upload, clears the recorded route and retires independently', async t=>{
  localFiles(t);
  let runIdle, finishUpload;
  globalThis.window={requestIdleCallback(callback){runIdle=callback;}};
  globalThis.document={addEventListener(){}};
  t.after(()=>{delete globalThis.window;delete globalThis.document;});
  await R.init();
  const physics=new R.World({x:0,y:0,z:0}), scene=new T.Scene();
  t.after(()=>physics.free());
  const add=({center:[x,y,z],size:[w,h,d],yaw=0})=>physics.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2)
    .setTranslation(x,y,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));
  const guards=[], seats=[];
  let footprint, loaded, profile;
  const mount=createStorefrontBenchMount(T,store,casioStorefrontPiano,spec=>{
    const shape=add(spec);guards.push(shape);
    return ()=>physics.removeCollider(shape,false);
  },seat=>{
    seats.push(seat);
    return ()=>{
      assert(physics.getCollider(guards[0].handle),'withdraw the seat before the solid instrument guard');
      seats.splice(seats.indexOf(seat),1);
    };
  });
  const studio=await createExpandedInteriors(T,expandedLayout,scene,undefined,async model=>{
    if(model.name.endsWith(casioStorefrontPiano.file))await new Promise(resolve=>{finishUpload=resolve;});
  },undefined,undefined,undefined,undefined,(model,measured)=>{
    assert(model.parent?.name==='S15 interior');
    loaded=model;profile=measured;mount(model,footprint.handle,undefined,profile);
  });
  for(const b of studio.collisionBoxes) {
    const shape=add({center:[b.x,b.y,b.z],size:[b.width,b.height,b.depth]});
    if(b===studio.storefrontPianoBox)footprint=shape;
  }
  assert(footprint);
  for(const body of store.colliders)add(worldInteriorBox(store,body));
  const stand={x:36.65,y:.081,z:26.98};
  studio.update(stand);
  runIdle();
  async function until(condition){
    for(let i=0;i<80&&!condition();i++)await new Promise(setImmediate);
    assert(condition());
  }
  await until(()=>finishUpload);
  assert.equal(seats.length,0);
  finishUpload();
  await until(()=>loaded);
  assert.equal(seats.length,1);
  assert.equal(guards.length,1);
  const [seat]=seats;
  assert.equal(seat.id,'casio-storefront-piano-bench');
  assert.equal(seat.collider,footprint.handle);
  assert.equal(seat.cabinetCollider,undefined);
  for(const [v,e] of [[seat.x,36.62922],[seat.y,.59250],[seat.z,25.90143],
    [seat.exitX,stand.x],[seat.exitZ,stand.z],[seat.floor,.081],[seat.angle,-1.3507963]])
    assert(Math.abs(v-e)<.00001);
  assert(isInFrontOfSeat(seat,stand));
  assert(seat.modelVisible());
  studio.update({x:0,y:0,z:0});assert(!seat.modelVisible());studio.update(stand);assert(seat.modelVisible());
  const lacquer=loaded.getObjectByName('MESH_Black_lacquer');
  lacquer.material.visible=false;assert(!seat.modelVisible());lacquer.material.visible=true;
  physics.step();
  const shape=new R.Capsule(.55,.30), upright={x:0,y:0,z:0,w:1};
  const sweep=(points,filter)=>{
    for(let i=1;i<points.length;i++)for(let j=0;j<=32;j++){
      const sample=points[i-1].clone().lerp(points[i],j/32);
      assert.equal(physics.intersectionWithShape(sample,upright,shape,undefined,undefined,undefined,undefined,filter),null,
        'blocked at '+sample.toArray());
    }
  };
  const path=[[35.9,28],[36.7,27.5],[stand.x,stand.z]].map(([x,z])=>new T.Vector3(x,seat.floor+.91,z));
  const target=new T.Vector3(seat.x,seat.floor+.89,seat.z);
  sweep(path);
  assert(physics.intersectionWithShape(target,upright,shape,undefined,undefined,undefined,undefined,
    c=>c.handle===footprint.handle));
  sweep([path.at(-1),target,path.at(-1)],c=>c.handle!==footprint.handle);
  assert(physics.intersectionWithShape(guards[0].translation(),upright,shape,undefined,undefined,undefined,undefined,
    c=>c.handle===guards[0].handle),'true grand stays solid when the broad proxy is ignored');
  const bounds=footprint.halfExtents(), c=footprint.translation(), guard=guards[0];
  const centre=new T.Vector3().copy(guard.translation()), half=guard.halfExtents();
  for(const x of [-half.x,half.x])for(const y of [-half.y,half.y])for(const z of [-half.z,half.z]){
    const point=new T.Vector3(x,y,z).applyQuaternion(new T.Quaternion().copy(guard.rotation())).add(centre);
    for(const axis of ['x','y','z'])assert(Math.abs(point[axis]-c[axis])<=bounds[axis]+.00001);
  }
  mount(loaded,footprint.handle,undefined,profile);
  assert.equal(seats[0],seat);
  assert.equal(guards.length,1);
  mount(null);
  assert.equal(seats.length,0);
  assert(!seat.modelVisible());
  assert(!physics.getCollider(guards[0].handle));
  assert(physics.getCollider(footprint.handle));
});
