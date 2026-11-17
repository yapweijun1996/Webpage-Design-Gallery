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

test('draw-call budget limits actual visitors without changing tier ceilings',()=>{
  const {system}=fixture({tier:'detailed',drawCallBudget:2,seats:[]});
  system.update(.016,player); assert.equal(system.state.active,2); assert.equal(system.state.drawCalls,2);
  system.setQuality({drawCallBudget:1}); system.update(.016,player);
  assert.equal(system.state.active,1); assert.equal(system.state.limit,1);
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
