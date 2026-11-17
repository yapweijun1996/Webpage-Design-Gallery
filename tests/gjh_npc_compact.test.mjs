import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {createNpcSystem} from '../demos/corporate/gjh/v11/assets/npcs.js';

test('real visitor shares compact colour-preserving skinned geometry without changing the source', async()=>{
  const data=await readFile(new URL('../demos/corporate/gjh/v11/assets/gjh-mall-visitor-v2.glb',import.meta.url));
  const source=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const names=new Set(['GJH emerald polo','Warm peach skin','Cream white','Swept chestnut hair','Denim cuff','Navy denim','Hoodie slate','Backpack charcoal','Backpack trim']);
  const key=(r,g,b)=>[r,g,b].map(v=>Math.round(v*100000)).join(',');
  const expected=new Map(),sourceResources=[];
  source.scene.traverse(node=>{
    if(!node.isSkinnedMesh || !names.has(node.material.name))return;
    const c=node.material.color,k=key(c.r,c.g,c.b);expected.set(k,(expected.get(k)||0)+node.geometry.attributes.position.count);
    sourceResources.push({node,geometry:node.geometry,material:node.material});
  });
  const scene=new T.Scene(), system=createNpcSystem(T,{scene,source,seats:[],physics:{intersectionWithShape:()=>null},R:{Capsule:class{}},playerCollider:{},playerBody:{},tier:'balanced'});
  system.update(.1,{x:0,y:0,z:10});
  assert.equal(system.state.callsPerNpc,3);assert.ok(scene.children.length>0);
  let combined;scene.children[0].traverse(node=>{if(node.isSkinnedMesh && node.material?.vertexColors)combined=node;});
  assert.ok(combined,'compact skinned mesh should use vertex colours');
  const colors=combined.geometry.attributes.color,actual=new Map();
  for(let i=0;i<colors.count;i++){const k=key(colors.getX(i),colors.getY(i),colors.getZ(i));actual.set(k,(actual.get(k)||0)+1);}
  assert.deepEqual(actual,expected);
  assert.ok(!sourceResources.some(({geometry})=>geometry===combined.geometry));
  assert.ok(!sourceResources.some(({material})=>material===combined.material));
  for(const record of sourceResources){assert.equal(record.node.geometry,record.geometry);assert.equal(record.node.material,record.material);}
  let disposed=0,sourceDisposed=0;combined.geometry.addEventListener('dispose',()=>disposed++);sourceResources[0].geometry.addEventListener('dispose',()=>sourceDisposed++);
  system.dispose();assert.equal(disposed,1);assert.equal(sourceDisposed,0);
});

test('changed or custom PBR material stays separate from the compact visitor', async()=>{
  for(const mutate of [m=>{m.roughness=.2;},m=>{m.onBeforeCompile=()=>{};},m=>{m.onBeforeRender=()=>{};}]) {
    const data=await readFile(new URL('../demos/corporate/gjh/v11/assets/gjh-mall-visitor-v2.glb',import.meta.url));
    const source=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
    const part=source.scene.getObjectByName('V2_body_Warm_peach_skin');assert.ok(part);
    part.material=part.material.clone();mutate(part.material);
    const scene=new T.Scene(),system=createNpcSystem(T,{scene,source,seats:[],physics:{intersectionWithShape:()=>null},R:{Capsule:class{}},playerCollider:{},playerBody:{},tier:'balanced'});
    system.update(.1,{x:0,y:0,z:10});assert.equal(system.state.callsPerNpc,4);
    const copied=scene.children[0].getObjectByName(part.name);assert.ok(copied);assert.equal(copied.material,part.material);system.dispose();
  }
});

test('hidden ancestor and different shadow policy are never compacted into visible parts', async()=>{
  for(const mode of ['hidden-parent','shadow']) {
    const data=await readFile(new URL('../demos/corporate/gjh/v11/assets/gjh-mall-visitor-v2.glb',import.meta.url));
    const source=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
    const part=source.scene.getObjectByName('V2_body_Warm_peach_skin');assert.ok(part);
    if(mode==='hidden-parent'){const hidden=new T.Group();hidden.name='hidden-part';hidden.visible=false;source.scene.add(hidden);hidden.add(part);}
    else part.castShadow=true;
    const scene=new T.Scene(),system=createNpcSystem(T,{scene,source,seats:[],physics:{intersectionWithShape:()=>null},R:{Capsule:class{}},playerCollider:{},playerBody:{},tier:'balanced'});
    system.update(.1,{x:0,y:0,z:10});
    const copy=scene.children[0].getObjectByName(part.name);assert.ok(copy,mode);assert.equal(copy.geometry,part.geometry);assert.equal(copy.material,part.material);
    if(mode==='hidden-parent')assert.equal(copy.parent.visible,false);
    system.dispose();
  }
});

test('real visitor admission stays stable with narrow draw headroom', async()=>{
  const data=await readFile(new URL('../demos/corporate/gjh/v11/assets/gjh-mall-visitor-v2.glb',import.meta.url));
  const source=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const scene=new T.Scene(),system=createNpcSystem(T,{scene,source,seats:[],physics:{intersectionWithShape:()=>null},R:{Capsule:class{}},playerCollider:{},playerBody:{},tier:'balanced'});
  system.update(.1,{x:0,y:0,z:10});for(let i=0;i<32;i++)system.admit(190);
  assert.equal(system.state.callsPerNpc,3);assert.equal(system.state.visible,2);
  const chosen=scene.children.filter(node=>node.visible).map(node=>node.uuid);
  for(let i=0;i<120;i++){
    const base=i%2?191:190;system.admit(base);
    assert.deepEqual(scene.children.filter(node=>node.visible).map(node=>node.uuid),chosen);
    assert.ok(base+system.state.drawCalls<=200);
  }
  system.dispose();
});

test('instanced or batched skinned meshes retain their own geometry and material', async()=>{
  for(const flag of ['isInstancedMesh','isBatchedMesh']) {
    const data=await readFile(new URL('../demos/corporate/gjh/v11/assets/gjh-mall-visitor-v2.glb',import.meta.url));
    const source=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
    const original=source.scene.getObjectByName('V2_body_Warm_peach_skin');assert.ok(original);
    class SpecialMesh extends T.SkinnedMesh {}
    SpecialMesh.prototype[flag]=true;
    const special=new SpecialMesh(original.geometry,original.material);special.name=original.name;special.bind(original.skeleton,original.bindMatrix);
    original.parent.add(special);original.parent.remove(original);
    const scene=new T.Scene(),system=createNpcSystem(T,{scene,source,seats:[],physics:{intersectionWithShape:()=>null},R:{Capsule:class{}},playerCollider:{},playerBody:{},tier:'balanced'});
    system.update(.1,{x:0,y:0,z:10});const clone=scene.children[0].getObjectByName(special.name);
    assert.ok(clone,flag);assert.equal(clone.geometry,special.geometry);assert.equal(clone.material,special.material);assert.equal(system.state.callsPerNpc,4);
    system.dispose();
  }
});
