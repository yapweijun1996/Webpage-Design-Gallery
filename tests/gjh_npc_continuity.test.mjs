import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createNpcSystem} from '../demos/corporate/gjh/v11/assets/npcs.js';

test('a seated visible visitor remains in place until the seat is needed', () => {
  const sourceScene=new T.Group(),bone=new T.Bone();bone.name='root';sourceScene.add(bone);
  const mesh=new T.SkinnedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial());sourceScene.add(mesh);mesh.bind(new T.Skeleton([bone]));
  const source={scene:sourceScene,animations:['idle','walk','sit'].map(name=>new T.AnimationClip(name,1,[new T.NumberKeyframeTrack('.position[y]',[0,1],[0,0])]))};
  const scene=new T.Scene(), seat={id:'bench',x:-7,y:.015,z:7,exitX:-7,exitZ:5.8,floor:0,angle:0,accessible:true};
  const system=createNpcSystem(T,{scene,source,seats:[seat],physics:{intersectionWithShape:()=>null},R:{Capsule:class {}},playerCollider:{},playerBody:{},tier:'balanced'});
  const player={x:0,y:0,z:10,seatId:null};
  system.update(.1,player);for(let i=0;i<48;i++)system.admit(0);
  const sitter=scene.children.find(child=>Math.hypot(child.position.x-seat.x,child.position.z-seat.z)<.01);
  assert.ok(sitter?.visible,'expected a visible seated visitor');
  for(let i=0;i<250;i++){system.update(.1,player);system.admit(0);assert.ok(scene.children.includes(sitter),'seated visitor disappeared without moving');}
  assert.equal(sitter.position.x,seat.x);assert.equal(sitter.position.z,seat.z);
  assert.equal(system.releaseSeat(seat.id),true);assert.ok(!scene.children.includes(sitter));
  system.dispose();
});
