import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createElevatorV2} from '../demos/corporate/gjh/v11/assets/elevator-v2.js';
import {EVERYDAY,MALL_THEMES} from '../demos/corporate/gjh/v11/assets/mall-themes.js';

function fixture(){
 const colliders=[];
 const R={ColliderDesc:{cuboid:(...half)=>({half,setRotation(q){this.rotation=q;return this;},setTranslation(x,y,z){this.position={x,y,z};return this;}})}};
 const physics={createCollider(desc){const item={half:desc.half,position:desc.position,enabled:true,setEnabled(value){this.enabled=value;},setTranslation(value){this.position={...value};}};colliders.push(item);return item;}};
 const scene=new T.Scene(),lift=createElevatorV2(T,R,physics,scene,true);
 const meshes=scene.children.filter(node=>node.isMesh&&node.geometry.hasAttribute('obSurface')&&!node.userData.deckLod);
 const bytes=attribute=>createHash('sha256').update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength)).digest('hex');
 const attributes=()=>meshes.map(mesh=>Object.fromEntries(['position','normal','color','obSurface'].map(key=>[key,bytes(mesh.geometry.getAttribute(key))])));
 const collisions=()=>colliders.map(({half,position,enabled})=>({half:[...half],position:{...position},enabled}));
 return {lift,meshes,attributes,collisions};
}

test('Everyday restores all six real Three lift batches without geometry or collider mutation',()=>{
 const f=fixture(),original=f.attributes(),collisions=f.collisions(),geometry=f.meshes.map(m=>m.geometry),materials=f.meshes.map(m=>m.material);
 assert.equal(f.meshes.length,6);assert.equal(f.lift.applyMallTheme(EVERYDAY),true);assert.deepEqual(f.attributes(),original);
 for(const theme of MALL_THEMES){
  assert.equal(f.lift.applyMallTheme(theme),true);
  const after=f.attributes();
  for(let i=0;i<after.length;i++)for(const key of ['position','normal','obSurface'])assert.equal(after[i][key],original[i][key]);
  assert.deepEqual(f.collisions(),collisions);assert.deepEqual(f.meshes.map(m=>m.geometry),geometry);assert.deepEqual(f.meshes.map(m=>m.material),materials);
  if(theme.id!=='everyday')assert(after.some((item,i)=>item.color!==original[i].color));
 }
 assert.equal(f.lift.applyMallTheme(EVERYDAY),true);assert.deepEqual(f.attributes(),original);
});

test('invalid lift palette fails before any partial batch update',()=>{
 const f=fixture();assert.equal(f.lift.applyMallTheme(MALL_THEMES.find(item=>item.id==='christmas')),true);
 const before=f.attributes(),collisions=f.collisions();
 for(const invalid of [-1,0x1000000,null,'16777215',NaN]){
  assert.equal(f.lift.applyMallTheme({...EVERYDAY,materials:{...EVERYDAY.materials,liftGate:invalid}}),false);
  assert.deepEqual(f.attributes(),before);assert.deepEqual(f.collisions(),collisions);
 }
});
