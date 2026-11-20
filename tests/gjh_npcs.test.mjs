import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {cloneNpcRig,createNpcSystem,npcLimit,nextNpcAdmission} from '../demos/corporate/gjh/v11/assets/npcs.js';
import {SHELL_LAYOUT} from '../demos/corporate/gjh/v11/assets/interior-shell-registry.js';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {createPlayerTram, tramLanding} from '../demos/corporate/gjh/v11/assets/tram-ride.js';
import {tramRoute} from '../demos/corporate/gjh/v11/assets/tram-layout.js';

function model() {
  const scene=new T.Group(), bone=new T.Bone(); bone.name='root'; scene.add(bone);
  const mesh=new T.SkinnedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial());
  scene.add(mesh); mesh.bind(new T.Skeleton([bone]));
  const animations=['idle','walk','sit'].map(name=>new T.AnimationClip(name,1,[new T.NumberKeyframeTrack('.position[y]',[0,1],[0,0])]));
  return {scene,mesh,bone,animations};
}
const seat=(id,x,z)=>({id,x,y:.015,z,exitX:x,exitZ:z-1.2,floor:0,angle:0,accessible:true});
function fixture(options={}) {
  const source=model(),scene=new T.Scene(); let blocked=false;
  const physics={intersectionWithShape:()=>blocked?{}:null};
  const system=createNpcSystem(T,{scene,source,seats:[seat('a',-7,7),seat('b',7,7)],physics,R:{Capsule:class {}},playerCollider:{},playerBody:{},...options});
  return {system,scene,source,block:value=>{blocked=value;}};
}
const player={x:0,y:0,z:10,seatId:null};
const admitFrames=(system,calls=0,frames=48)=>{for(let i=0;i<frames;i++) system.admit(calls);};

test('entry crowd keeps the tram landing clear through boarding and return', async t => {
  const fetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async url =>
    String(url).startsWith('file:') ? new Response(await readFile(url)) : fetch(url));
  const previousSelf = globalThis.self, previousBitmap = globalThis.createImageBitmap;
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({width:7, height:1});
  t.after(() => {
    if (previousSelf === undefined) delete globalThis.self;
    else globalThis.self = previousSelf;
    if (previousBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = previousBitmap;
  });
  const {system,scene} = fixture({expanded:true, tram:true, seats:[], tier:'balanced'});
  t.after(() => system.dispose());
  // Spawn the crowd while the player is approaching the station from the entrance.
  let position = {x:tramLanding.x, y:.89, z:tramLanding.z + 6};
  const updateCrowd = dt => system.update(dt, {...position, y:position.y - .875});
  updateCrowd(.016);
  admitFrames(system);
  assert.ok(system.state.visible > 0);
  position = {...position, z:tramLanding.z};
  const tram = createPlayerTram({expanded:true, search:'?tram=1', T, scene,
    getPosition:() => position, getBoardReason:() => '', clearPath:() => true,
    enterSeat:(_, {x,z}) => {position = {x,y:1.05,z};},
    exitSeat:landing => {position = landing;}
  });
  t.after(() => tram.dispose());
  assert.equal(tram.controls.board(), false);
  for (let i = 0; i < 150 && tram.controls.reason; i++) await delay(10);
  assert.equal(tram.controls.board(), true, tram.controls.reason);
  function tick() {
    const pose = tram.update(.1);
    if (pose) position = {x:pose.x, y:1.05, z:pose.z};
    updateCrowd(.1);
  }
  for (let i = 0; i < 60; i++) tick();
  assert.equal(tram.controls.state.phase, 'ride');
  const lapTicks = Math.ceil(tramRoute.length / .15) + 20;
  for (let i = 0; i < lapTicks && tram.controls.state.active; i++) {
    tick();
    assert.equal(tram.controls.state.blocked, false);
  }
  assert.equal(tram.controls.state.phase, 'idle', JSON.stringify({
    ride:tram.controls.state,
    crowd:scene.children.filter(node => node.isGroup && node.visible).map(node => node.position)
  }));
  assert.equal(position.z, tramLanding.z);
});

test('ambient admission fits the tighter of the expanded frame budgets', () => {
  const previous = {admitted:4,safeFrames:0};
  const budget = {limit:4,totalCallCap:90,triangleCap:300000,callsPerNpc:3,trianglesPerNpc:12000};
  assert.equal(nextNpcAdmission(previous,{...budget,nonNpcCalls:77,nonNpcTriangles:278000}).admitted,1);
  assert.equal(nextNpcAdmission(previous,{...budget,nonNpcCalls:89,nonNpcTriangles:160000}).admitted,0);
  assert.equal(nextNpcAdmission(previous,{...budget,nonNpcCalls:70,nonNpcTriangles:252000}).admitted,4);
  assert.equal(nextNpcAdmission(previous,{...budget,nonNpcCalls:70,nonNpcTriangles:NaN}).admitted,0);
});
const meshes=root=>{const result=[];root.traverse(node=>{if(node.isMesh) result.push(node);});return result;};

test('unknown headroom hides immediately and cannot retain a safe-frame streak',()=>{
  for(const nonNpcCalls of [undefined,null,NaN,Infinity,-1]) {
    const previous={admitted:4,safeFrames:7};
    const next=nextNpcAdmission(previous,{nonNpcCalls,callsPerNpc:3,limit:6});
    assert.equal(next.admitted,0); assert.equal(next.safeFrames,0); assert.equal(next.budgetKnown,false);
    assert.deepEqual(previous,{admitted:4,safeFrames:7});
  }
});

test('current-frame cost increases cut immediately; decreases add one every eight safe frames',()=>{
  const options={nonNpcCalls:150,callsPerNpc:10,limit:6};
  let state={admitted:4,safeFrames:7};
  state=nextNpcAdmission(state,{...options,nonNpcCalls:179});
  assert.equal(state.admitted,2); assert.equal(state.safeFrames,0);
  state=nextNpcAdmission(state,{...options,nonNpcCalls:201});
  assert.equal(state.admitted,0);
  for(let i=0;i<7;i++) {
    state=nextNpcAdmission(state,options);
    assert.equal(state.admitted,0); assert.equal(state.safeFrames,i+1);
  }
  state=nextNpcAdmission(state,options); assert.equal(state.admitted,1); assert.equal(state.safeFrames,0);
  for(let i=0;i<8;i++) state=nextNpcAdmission(state,options);
  assert.equal(state.admitted,2);
  for(let i=0;i<80;i++) state=nextNpcAdmission(state,options);
  assert.equal(state.admitted,4); // A fifth would leave no four-call margin.
  assert.ok(state.nonNpcCalls+state.admitted*options.callsPerNpc<=200);
});

test('four-call growth margin resets interrupted streaks without evicting safe incumbents',()=>{
  const options={callsPerNpc:10,limit:6};
  let state={admitted:1,safeFrames:7};
  state=nextNpcAdmission(state,{...options,nonNpcCalls:177}); // Only three calls beyond the next NPC.
  assert.equal(state.admitted,1); assert.equal(state.safeFrames,0);
  for(let i=0;i<7;i++) state=nextNpcAdmission(state,{...options,nonNpcCalls:176});
  assert.equal(state.admitted,1);
  state=nextNpcAdmission(state,{...options,nonNpcCalls:176}); assert.equal(state.admitted,2);
  state=nextNpcAdmission(state,{...options,nonNpcCalls:180});
  assert.equal(state.admitted,2); // Exact fits may remain, but cannot grow.
  state=nextNpcAdmission(state,{...options,nonNpcCalls:180.1});
  assert.equal(state.admitted,1); // Fractional measurements round conservatively.
});

test('admission obeys tier, mobile, off, active population and optional extra allowance caps',()=>{
  for(const mobile of [false,true]) for(const tier of ['low','balanced','detailed']) {
    const limit=npcLimit({mobile,tier});
    let state={};
    for(let i=0;i<80;i++) state=nextNpcAdmission(state,{nonNpcCalls:0,callsPerNpc:1,limit});
    assert.equal(state.admitted,limit);
    assert.equal(nextNpcAdmission(state,{nonNpcCalls:0,callsPerNpc:1,limit:npcLimit({mobile,tier,enabled:false})}).admitted,0);
  }
  assert.equal(nextNpcAdmission({admitted:6},{nonNpcCalls:0,callsPerNpc:1,limit:6,active:2}).admitted,2);
  assert.equal(nextNpcAdmission({admitted:6},{nonNpcCalls:0,callsPerNpc:1,limit:6,drawCallBudget:2}).admitted,2);
  for(const callsPerNpc of [0,NaN,Infinity,-1]) assert.equal(nextNpcAdmission({admitted:6},{nonNpcCalls:0,callsPerNpc,limit:6}).admitted,0);
});

test('quality budgets respect desktop and mobile caps and the off switch',()=>{
  assert.deepEqual(['low','balanced','detailed'].map(tier=>npcLimit({tier})),[2,4,6]);
  assert.deepEqual(['low','balanced','detailed'].map(tier=>npcLimit({tier,mobile:true})),[1,2,3]);
  assert.equal(npcLimit({tier:'detailed',enabled:false}),0);
});

test('independent skeletons share the source geometry and material',()=>{
  const source=model(),a=cloneNpcRig(source.scene),b=cloneNpcRig(source.scene);
  const ma=a.children.find(n=>n.isSkinnedMesh), mb=b.children.find(n=>n.isSkinnedMesh);
  assert.equal(ma.geometry,source.mesh.geometry); assert.equal(mb.material,source.mesh.material);
  assert.notEqual(ma.skeleton,mb.skeleton); assert.notEqual(ma.skeleton.bones[0],mb.skeleton.bones[0]);
  assert.notEqual(ma.skeleton.bones[0],source.bone);
});

test('distance loading, player-priority seats, quality changes and disposal',()=>{
  const {system,scene}=fixture({tier:'detailed'});
  system.update(.016,player);
  assert.equal(system.state.active,6); assert.equal(system.state.visible,0);
  admitFrames(system); assert.equal(system.state.visible,6);
  assert.ok(system.occupiedSeatIds.length>0);
  const id=system.occupiedSeatIds[0]; assert.equal(system.releaseSeat(id),true);
  system.update(.016,{...player,seatId:id}); assert.ok(!system.occupiedSeatIds.includes(id));
  system.setQuality({tier:'low',mobile:true}); system.update(.016,player);
  assert.equal(system.state.tier,'low'); assert.equal(system.state.active,1);
  system.setQuality({enabled:false}); system.update(.016,player);
  assert.equal(system.state.active,0); assert.equal(scene.children.length,0);
  system.setQuality({enabled:true}); system.update(.016,{x:500,y:0,z:500});
  assert.equal(system.state.active,0);
  system.update(.016,player); assert.ok(system.state.active>0);
  system.dispose(); assert.equal(scene.children.length,0); system.update(.016,player); assert.equal(system.state.active,0);
});

test('physics blocks spawn and paths; approaching a visitor does not remove it',()=>{
  const {system,scene,block}=fixture({seats:[],tier:'low'});
  block(true); system.update(.016,player); assert.equal(system.state.active,0);
  block(false); system.update(.016,player); assert.equal(system.state.active,2);
  const visitor=scene.children[0], p=visitor.position.clone();
  system.update(.016,{x:p.x,y:0,z:p.z,seatId:null});
  assert.ok(scene.children.includes(visitor));
});

test('walking visitors face their direction of travel',()=>{
  const {system,scene}=fixture({seats:[],tier:'low'});
  system.update(.016,player); admitFrames(system);
  let checked=false;
  for(let i=0;i<150 && !checked;i++) {
    const before=scene.children.map(visual=>({visual,position:visual.position.clone()}));
    system.update(.1,player);
    for(const {visual,position} of before) {
      const displacement=visual.position.clone().sub(position); displacement.y=0;
      if(displacement.length()<.001) continue;
      const facing=visual.children[0].children[0].getWorldDirection(new T.Vector3()); facing.y=0;
      assert.ok(facing.normalize().dot(displacement.normalize())>.99);
      checked=true; break;
    }
  }
  assert.ok(checked, 'a visitor must walk during the test');
  system.dispose();
});

test('missing shared model disables the system without loading anything',()=>{
  const {system}=fixture({source:undefined}); system.update(.016,player);
  assert.equal(system.state.available,false); assert.equal(system.state.active,0); assert.equal(system.state.limit,0);
});

test('authored world obstacles reject intersecting route candidates',()=>{
  const boxes=SHELL_LAYOUT.aggregate_colliders.map(({position,size})=>({position,size}));
  const garden=atriumLayout.garden;
  const expandedBoxes=[
    {position:[garden.x,garden.height/2,garden.z],size:[garden.width,garden.height,garden.depth]},
    {position:[liftLayout.x,1,liftLayout.z],size:[liftLayout.shaft.maxX-liftLayout.shaft.minX,2,liftLayout.shaft.maxZ-liftLayout.shaft.minZ]},
  ];
  const intersects=(p,box)=>Math.abs(p.x-box.position[0])<box.size[0]/2+.3 &&
    Math.abs(p.y-box.position[1])<box.size[1]/2+.85 && Math.abs(p.z-box.position[2])<box.size[2]/2+.3;
  for(const [expanded,obstacles,visitor] of [[false,boxes,player],[true,expandedBoxes,{x:10,y:0,z:12}]]) {
    const scene=new T.Scene();
    const system=createNpcSystem(T,{scene,source:model(),seats:[],expanded,tier:'detailed',R:{Capsule:class {}},
      physics:{intersectionWithShape:p=>obstacles.some(box=>intersects(p,box))?{}:null}});
    system.update(.016,visitor);
    assert.ok(system.state.active>0);
    for(const child of scene.children) {
      const p=child.position;
      assert.ok(!obstacles.some(box=>intersects({x:p.x,y:p.y+.91,z:p.z},box)));
    }
  }
});

test('budget admission changes visibility without disturbing independent simulation',()=>{
  const {system,scene}=fixture({tier:'detailed',drawCallBudget:10,seats:[]});
  system.update(.016,player);
  assert.equal(system.state.active,6); assert.equal(system.state.limit,6);
  assert.equal(system.state.visible,0); assert.equal(system.state.budgetKnown,false);
  admitFrames(system); assert.equal(system.state.visible,6);
  const avatars=scene.children.slice();
  system.setDrawCallBudget(2);
  assert.equal(system.state.visible,2); assert.equal(system.state.drawCalls,2);
  assert.deepEqual(scene.children,avatars);
  system.setDrawCallBudget(0);
  assert.equal(system.state.visible,0); assert.equal(system.state.active,6);
  for(let i=0;i<100;i++) system.update(.1,player);
  assert.equal(system.state.active,6);
  system.setDrawCallBudget(10);
  assert.equal(system.state.visible,0);
  admitFrames(system,0,7); assert.equal(system.state.visible,0);
  assert.equal(system.admit(0),1);
  admitFrames(system); assert.equal(system.state.visible,6);
  system.setVisible(false); system.update(.016,player);
  assert.equal(system.state.visible,0); assert.equal(system.state.admitted,6);
  assert.equal(system.admit(198),2);
  assert.equal(system.state.nonNpcCalls,198); assert.equal(system.state.headroom,2);
  assert.equal(system.admit(undefined),0); assert.equal(system.state.admitted,0);
  assert.equal(system.state.active,6);
  system.setQuality({enabled:false}); assert.equal(system.state.visible,0);
  system.update(.016,player); assert.equal(system.state.active,0);
});

test('visibility does not swap visitors when the player changes nearest order',()=>{
  const {system,scene}=fixture({tier:'low',seats:[],drawCallBudget:10});
  system.update(.016,player); admitFrames(system); system.setDrawCallBudget(1);
  const visible=scene.children.find(child=>child.visible);
  assert.ok(visible);
  const other=scene.children.find(child=>child!==visible);
  system.update(.016,{x:other.position.x+2,y:0,z:other.position.z,seatId:null});
  assert.equal(visible.visible,true);
  assert.equal(other.visible,false);
  system.dispose();
});

test('compatible skinned and static parts merge once with owned buffers and independent rigs',()=>{
  const source=model(),shared=source.mesh.geometry;
  shared.clearGroups();
  const skinned=new T.SkinnedMesh(shared,source.mesh.material);
  source.scene.add(skinned); skinned.bind(source.mesh.skeleton);
  const material=new T.MeshBasicMaterial(),staticGeometry=new T.BoxGeometry();
  staticGeometry.clearGroups();
  source.scene.add(new T.Mesh(staticGeometry,material),new T.Mesh(staticGeometry,material));
  const hidden=new T.Mesh(staticGeometry,material); hidden.visible=false; source.scene.add(hidden);
  const {system,scene}=fixture({source,seats:[],tier:'low'});
  system.update(.016,player); admitFrames(system);
  assert.equal(system.state.callsPerNpc,2);
  const a=meshes(scene.children[0]).filter(node=>node.visible),b=meshes(scene.children[1]).filter(node=>node.visible);
  assert.equal(a.length,2); assert.equal(b.length,2);
  assert.equal(a[0].geometry,b[0].geometry); assert.equal(a[1].geometry,b[1].geometry);
  assert.notEqual(a[0].geometry,shared); assert.notEqual(a[1].geometry,staticGeometry);
  assert.equal(a[0].geometry.attributes.position.count,shared.attributes.position.count*2);
  assert.notEqual(a[0].skeleton,b[0].skeleton); assert.notEqual(a[0].skeleton.bones[0],b[0].skeleton.bones[0]);
  assert.notEqual(a[0].skeleton.bones[0],source.bone);
  a[0].skeleton.bones[0].position.x=4;
  assert.equal(b[0].skeleton.bones[0].position.x,0); assert.equal(source.bone.position.x,0);
  for(const visual of scene.children) visual.traverse(node=>{
    assert.equal(node.layers.mask,1<<2);
    if(node.isMesh) {
      assert.equal(node.castShadow,false); assert.equal(node.receiveShadow,true);
      assert.equal(node.raycast(),undefined);
    }
  });
  let disposed=0,sourceDisposed=0;
  source.mesh.skeleton.dispose=()=>sourceDisposed++;
  a[0].geometry.addEventListener('dispose',()=>disposed++); a[1].geometry.addEventListener('dispose',()=>disposed++);
  for(const resource of [shared,staticGeometry,source.mesh.material,material]) resource.addEventListener('dispose',()=>sourceDisposed++);
  system.dispose(); system.dispose();
  assert.equal(disposed,2); assert.equal(sourceDisposed,0);
  assert.equal(source.mesh.geometry,shared); assert.equal(source.scene.children.length,6);
  assert.equal(source.mesh.layers.mask,1); assert.equal(source.mesh.geometry.attributes.position.count,24);
});

test('animated mesh names and UUIDs are excluded from merging',()=>{
  for(const byUuid of [false,true]) {
    const source=model(); source.mesh.geometry.clearGroups(); source.mesh.name='moving';
    const second=new T.SkinnedMesh(source.mesh.geometry,source.mesh.material);
    source.scene.add(second); second.bind(source.mesh.skeleton);
    source.animations[0].tracks.push(new T.NumberKeyframeTrack(`${byUuid?source.mesh.uuid:'moving'}.position[x]`,[0,1],[0,1]));
    const {system,scene}=fixture({source,seats:[]}); system.update(.016,player);
    assert.equal(system.state.callsPerNpc,2);
    assert.ok(meshes(scene.children[0]).every(mesh=>mesh.geometry===source.mesh.geometry));
    system.dispose();
  }
});

test('unsafe geometry, transforms, materials, hierarchy and skin bindings stay separate',()=>{
  const cases=[
    (a,b)=>{b.position.x=1;},
    (a,b)=>{b.renderOrder=1;},
    (a,b)=>{b.frustumCulled=false;},
    (a,b)=>{b.material=new T.MeshBasicMaterial();},
    (a,b)=>{b.material=a.material.clone(); b.material.transparent=true;},
    (a,b)=>{b.geometry=b.geometry.clone(); b.geometry.addGroup(0,3,0);},
    (a,b)=>{b.geometry=b.geometry.clone(); b.geometry.setDrawRange(0,3);},
    (a,b)=>{b.geometry=b.geometry.toNonIndexed();},
    (a,b)=>{b.geometry=b.geometry.clone(); b.geometry.morphAttributes.position=[b.geometry.attributes.position.clone()];},
    (a,b)=>{b.add(new T.Group());},
    (a,b)=>{const parent=new T.Group(); a.parent.add(parent); parent.add(b);},
    (a,b)=>{b.bindMatrix.makeTranslation(1,0,0);},
    (a,b)=>{b.skeleton=new T.Skeleton(b.skeleton.bones,[new T.Matrix4().makeTranslation(1,0,0)]);},
    (a,b)=>{b.geometry=b.geometry.clone(); b.geometry.deleteAttribute('uv');},
  ];
  for(const alter of cases) {
    const source=model(); source.mesh.geometry.clearGroups();
    const second=new T.SkinnedMesh(source.mesh.geometry,source.mesh.material);
    source.scene.add(second); second.bind(source.mesh.skeleton); alter(source.mesh,second);
    const {system,scene}=fixture({source,seats:[]}); system.update(.016,player);
    assert.equal(system.state.callsPerNpc,2);
    assert.equal(meshes(scene.children[0]).length,2);
    system.dispose();
  }
});

test('shared transparent surfaces retain separate sorting and double-sided passes',()=>{
  const source=model(); source.mesh.geometry.clearGroups();
  source.mesh.material.transparent=true; source.mesh.material.side=T.DoubleSide;
  const second=new T.SkinnedMesh(source.mesh.geometry,source.mesh.material);
  source.scene.add(second); second.bind(source.mesh.skeleton);
  const {system,scene}=fixture({source,seats:[]}); system.update(.016,player);
  assert.equal(system.state.callsPerNpc,4);
  assert.equal(meshes(scene.children[0]).length,2);
  system.dispose();
});

test('pass counts account for double-sided transparency, groups and hidden materials',()=>{
  const source=model(); source.mesh.material.transparent=true;
  source.mesh.material.side=T.DoubleSide;
  const {system}=fixture({source,seats:[]}); assert.equal(system.state.callsPerNpc,2); system.dispose();
  source.mesh.material.forceSinglePass=true;
  const single=fixture({source,seats:[]}).system; assert.equal(single.state.callsPerNpc,1); single.dispose();
  source.mesh.material.forceSinglePass=false; source.mesh.material.side=T.FrontSide;
  const front=fixture({source,seats:[]}).system; assert.equal(front.state.callsPerNpc,1); front.dispose();
  const transparent=new T.MeshBasicMaterial({transparent:true,side:T.DoubleSide});
  const hidden=new T.MeshBasicMaterial({visible:false});
  source.mesh.material=[new T.MeshBasicMaterial(),transparent,hidden];
  source.mesh.geometry.clearGroups();
  source.mesh.geometry.addGroup(0,3,0); source.mesh.geometry.addGroup(3,3,1); source.mesh.geometry.addGroup(6,3,2);
  const grouped=fixture({source,seats:[]}).system; assert.equal(grouped.state.callsPerNpc,3); grouped.dispose();
});

test('player geometry, visibility, material arrays and LOD switches cannot alter frozen NPC choices',()=>{
  const source=model(),original=source.mesh.geometry,material=source.mesh.material;
  source.mesh.material=[material];
  const lod=new T.LOD(),near=new T.Mesh(new T.BoxGeometry(),material),far=new T.Mesh(new T.BoxGeometry(),material);
  lod.addLevel(near,0); lod.addLevel(far,5); near.visible=true; far.visible=false; source.scene.add(lod);
  const hiddenGroup=new T.Group(); hiddenGroup.visible=false; hiddenGroup.add(new T.Mesh(new T.BoxGeometry(),material)); source.scene.add(hiddenGroup);
  const {system,scene}=fixture({source,seats:[],tier:'low'});
  source.mesh.geometry=new T.SphereGeometry(); source.mesh.visible=false; source.mesh.material[0]=new T.MeshBasicMaterial({transparent:true,side:T.DoubleSide});
  near.visible=false; far.visible=true;
  system.update(.016,player);
  const avatar=scene.children[0].children[0].children[0],mesh=meshes(avatar).find(node=>node.isSkinnedMesh);
  assert.equal(mesh.geometry,original); assert.equal(mesh.visible,true); assert.equal(mesh.material[0],material);
  const copyLod=avatar.children.find(node=>node.isLOD);
  assert.equal(copyLod.autoUpdate,false); assert.equal(copyLod.levels[0].object.visible,true); assert.equal(copyLod.levels[1].object.visible,false);
  assert.equal(system.state.callsPerNpc,2);
  let disposed=0; original.addEventListener('dispose',()=>disposed++);
  system.dispose(); assert.equal(disposed,0);
});

test('walking checks clearance continuously and maintains visitor spacing',()=>{
  const {system,scene,block}=fixture({seats:[],tier:'low'});
  system.update(.1,player);
  const initial=scene.children.map(child=>({x:child.position.x,z:child.position.z}));
  for(let i=0;i<100;i++) {
    system.update(.1,player);
    if(scene.children.length===2) assert.ok(scene.children[0].position.distanceTo(scene.children[1].position)>=1.2);
  }
  assert.ok(scene.children.some((child,i)=>Math.hypot(child.position.x-initial[i].x,child.position.z-initial[i].z)>.1));
  block(true);
  const stopped=scene.children.map(child=>({x:child.position.x,z:child.position.z}));
  for(let i=0;i<40;i++) system.update(.1,player);
  scene.children.forEach((child,i)=>{ assert.equal(child.position.x,stopped[i].x); assert.equal(child.position.z,stopped[i].z); });
});
