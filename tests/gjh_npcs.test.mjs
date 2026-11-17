import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {cloneNpcRig,createNpcSystem,npcLimit} from '../demos/corporate/gjh/v11/assets/npcs.js';
import {SHELL_LAYOUT} from '../demos/corporate/gjh/v11/assets/interior-shell-registry.js';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';

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
  assert.equal(system.state.active,6); assert.equal(system.state.visible,6);
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

test('physics blocks spawn and paths; player proximity removes visitors',()=>{
  const {system,scene,block}=fixture({seats:[],tier:'low'});
  block(true); system.update(.016,player); assert.equal(system.state.active,0);
  block(false); system.update(.016,player); assert.equal(system.state.active,2);
  const p=scene.children[0].position;
  system.update(.016,{x:p.x,y:0,z:p.z,seatId:null});
  assert.ok(scene.children.every(child=>Math.hypot(child.position.x-p.x,child.position.z-p.z)>=1.6));
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

test('dynamic draw-call budget changes visibility without disturbing simulation',()=>{
  const {system,scene}=fixture({tier:'detailed',drawCallBudget:2,seats:[]});
  system.update(.016,player);
  assert.equal(system.state.active,6); assert.equal(system.state.limit,6);
  assert.equal(system.state.visible,2); assert.equal(system.state.drawCalls,2);
  const avatars=scene.children.slice();
  system.setDrawCallBudget(1);
  assert.equal(system.state.visible,1); assert.equal(system.state.drawCalls,1);
  assert.deepEqual(scene.children,avatars);
  system.setDrawCallBudget(0);
  assert.equal(system.state.visible,0); assert.equal(system.state.active,6);
  for(let i=0;i<100;i++) system.update(.1,player);
  assert.equal(system.state.active,6);
  system.setDrawCallBudget(6);
  assert.equal(system.state.visible,6); assert.equal(system.state.drawCalls,6);
  system.setVisible(false); system.update(.016,player);
  assert.equal(system.state.visible,0);
  system.setDrawCallBudget(2); system.setVisible(true);
  assert.equal(system.state.visible,2);
  system.setQuality({drawCallBudget:1}); assert.equal(system.state.visible,1);
  system.setQuality({enabled:false}); assert.equal(system.state.visible,0);
  system.update(.016,player); assert.equal(system.state.active,0);
});

test('compatible skinned and static parts merge once and share owned buffers',()=>{
  const source=model(), shared=source.mesh.geometry;
  shared.clearGroups();
  const skinned=new T.SkinnedMesh(shared,source.mesh.material);
  source.scene.add(skinned); skinned.bind(source.mesh.skeleton);
  const material=new T.MeshBasicMaterial(), staticGeometry=new T.BoxGeometry();
  staticGeometry.clearGroups();
  const first=new T.Mesh(staticGeometry,material),second=new T.Mesh(staticGeometry,material);
  source.scene.add(first,second);
  const hidden=new T.Mesh(staticGeometry,material); hidden.visible=false; source.scene.add(hidden);
  const {system,scene}=fixture({source,seats:[],tier:'low'});
  system.update(.016,player);
  assert.equal(system.state.callsPerNpc,2);
  const meshes=avatar=>{const result=[];avatar.traverse(node=>{if(node.isMesh && node.visible) result.push(node);});return result;};
  const a=meshes(scene.children[0]),b=meshes(scene.children[1]);
  assert.equal(a.length,2); assert.equal(b.length,2);
  assert.equal(a[0].geometry,b[0].geometry); assert.equal(a[1].geometry,b[1].geometry);
  assert.notEqual(a[0].geometry,shared); assert.notEqual(a[1].geometry,staticGeometry);
  assert.notEqual(a[0].skeleton,b[0].skeleton);
  assert.equal(a[0].castShadow,false); assert.equal(a[0].receiveShadow,true);
  let disposed=0; a[0].geometry.addEventListener('dispose',()=>disposed++); a[1].geometry.addEventListener('dispose',()=>disposed++);
  let sourceDisposed=0; shared.addEventListener('dispose',()=>sourceDisposed++);
  system.dispose(); assert.equal(disposed,2); assert.equal(sourceDisposed,0);
});

test('animated or differently transformed parts are not merged',()=>{
  const source=model(); source.mesh.geometry.clearGroups(); source.mesh.name='moving';
  const second=new T.SkinnedMesh(source.mesh.geometry,source.mesh.material);
  const third=new T.SkinnedMesh(source.mesh.geometry,source.mesh.material);
  third.position.x=1;
  source.scene.add(second,third); second.bind(source.mesh.skeleton); third.bind(source.mesh.skeleton);
  source.animations[0].tracks.push(new T.NumberKeyframeTrack('moving.position[x]',[0,1],[0,1]));
  const {system}=fixture({source,seats:[]}); system.update(.016,player);
  assert.equal(system.state.callsPerNpc,3);
});

test('player LOD and visibility changes do not alter the NPC template',()=>{
  const source=model(), original=source.mesh.geometry;
  const {system,scene}=fixture({source,seats:[],tier:'low'});
  source.mesh.geometry=new T.SphereGeometry(); source.mesh.visible=false;
  system.update(.016,player);
  const mesh=scene.children[0].children[0].children.find(node=>node.isSkinnedMesh);
  assert.equal(mesh.geometry,original); assert.equal(mesh.visible,true);
  assert.equal(system.state.callsPerNpc,1);
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
