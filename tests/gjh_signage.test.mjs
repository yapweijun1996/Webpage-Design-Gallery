import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {expandedLayout,shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {stores,resolveConfig,contrast,selectSignLod} from '../demos/corporate/gjh/v11/assets/signage/config.js';
import {presets} from '../demos/corporate/gjh/v11/assets/signage/presets.js';
import {atlasSize,atlasCells} from '../demos/corporate/gjh/v11/assets/signage/atlas-layout.js';
import {createShopSign,letterGeometry} from '../demos/corporate/gjh/v11/assets/signage/builder.js';
import {createSignageSystem} from '../demos/corporate/gjh/v11/assets/signage/runtime.js';
import {buildHardware,buildEndTrim} from '../demos/corporate/gjh/v11/assets/signage/hardware.js';
import {loadModules,modelFiles} from '../demos/corporate/gjh/v11/assets/signage/models.js';

const base=new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
const json=path=>JSON.parse(readFileSync(new URL(path,base)));
const kit=json('brand-kit/brand-kit.json'),receipts=json('brands/logo-sources.json');
const bays=expandedLayout.slots;
const setup=(i,settings=stores['S'+bays[i].number],logos=receipts)=>resolveConfig('S'+bays[i].number,settings,bays[i],kit,logos);

test('every occupied lot resolves a local, receipted official lockup and its own hero',()=>{
  assert.deepEqual(Object.keys(stores),bays.map(b=>'S'+b.number));
  for(const [i,b] of bays.entries()){
    const c=setup(i);
    assert.equal(c.brand,kit[c.id].brand);
    assert.equal(c.logoFile,receipts[c.id].file);
    for(const path of ['brands/'+c.logoFile,'brand-kit/'+c.poster+'-hero.webp'])assert.ok(existsSync(new URL(path,base)));
    assert.ok(contrast(c.palette.letter,c.palette.fascia)>=4.5);
    assert.ok(c.size.width < (b.side==='north'?b.maxX-b.minX:b.maxZ-b.minZ));
  }
  const resolved=bays.map((_,i)=>setup(i).preset);
  for(const key of Object.keys(presets))assert.ok(resolved.includes(key),key);
});

test('defaults, nested palette overrides, provenance fallback and all lockup variants',()=>{
  const defaults=setup(0,{});
  assert.equal(defaults.preset,'t1-classic');
  assert.equal(defaults.blade,true);assert.equal(defaults.backlight,'halo');
  for(const lockup of ['logo-left','logo-top','monogram','wordmark-only'])
    assert.equal(setup(0,{lockup}).lockup,lockup);
  const pale=setup(2,{preset:'t8-kids',palette:{accent:'#ffbbcc'},poster:null,blade:false});
  assert.equal(pale.palette.accent,'#ffbbcc');
  assert.equal(pale.palette.trim,presets['t8-kids'].palette.trim);
  assert.equal(pale.poster,null);assert.equal(pale.blade,false);
  assert.equal(setup(0,{logo:null}).lockup,'wordmark-only');
  assert.equal(setup(0,{},{}).lockup,'wordmark-only');
  const missing=setup(0,{}, {S01:{file:receipts.S01.file,status:'generated'}});
  assert.equal(missing.logoFile,null);assert.equal(missing.lockup,'wordmark-only');
});

test('reject wrong slots, invalid size limits, contrast, types, foreign marks and relief regions',()=>{
  for(const settings of [{preset:'store'}, {finish:'paper'}, {backlight:'laser'}, {typography:'unknown'},
    {lockup:'invent'}, {brand:''},{size:{height:.2}},{size:{width:9}},{size:{depth:.1}},{size:{width:NaN}},
    {blade:0},{pulse:1},{palette:{fascia:'#fff'}},{palette:{fascia:'#ffffff',letter:'#eeeeee'}},
    {logo:'S02'},{poster:'../../remote'},{lodDistance:Infinity},{logoRegion:[0,0,2,1]},{logoModule:'wrong'}])
    assert.throws(()=>setup(0,settings));
  assert.throws(()=>resolveConfig('S02',{},bays[0],kit,receipts));
  assert.throws(()=>resolveConfig('S01',{}, {...bays[0],maxX:bays[0].minX+2},kit,receipts));
});

test('power-of-two atlas charts and bilinear gutters are disjoint even at capacity',()=>{
  assert.equal(atlasSize & (atlasSize-1),0);
  const packed=Array.from({length:24},(_,i)=>Object.values(atlasCells(i))).flat();
  for(const [i,a] of packed.entries()){
    assert.ok(a.x>=2 && a.y>=2 && a.x+a.w<=atlasSize-2 && a.y+a.h<=atlasSize-2);
    for(const b of packed.slice(i+1))assert.ok(a.x+a.w+2<=b.x||b.x+b.w+2<=a.x||a.y+a.h+2<=b.y||b.y+b.h+2<=a.y);
  }
  for(const i of [-1,24,.5])assert.throws(()=>atlasCells(i));
});

test('pure bay builder gives each blade two readable outward faces, clear of the door',()=>{
  for(const [i,bay] of bays.entries()){
    const c=setup(i),g=createShopSign(T,c,bay),geometry=g.children[0].geometry;
    const {normalX,normalZ}=shopEntrance(bay);
    const normal=j=>new T.Vector3().fromBufferAttribute(geometry.attributes.normal,j).transformDirection(g.matrixWorld);
    assert.ok(normal(0).dot(new T.Vector3(normalX,0,normalZ))>.999);
    assert.ok(normal(4).dot(normal(8))<-.999);
    assert.ok(Math.abs(normal(0).dot(normal(4)))<1e-6);
    assert.ok(Math.abs(g.userData.mount.bladeX)>2.35);
    if(i<3)assert.ok(geometry.attributes.position.getY(0)>4.14,'clear the tracked anchor-store label');
    const without=createShopSign(T,{...c,blade:false},bay);
    assert.equal(geometry.index.count-without.children[0].geometry.index.count,12);
  }
});

test('unknown tiers, distance threshold and off-screen signs select the baked or culled path',()=>{
  for(const tier of ['low','auto',undefined])assert.equal(selectSignLod(tier,0,true,16),'baked');
  for(const tier of ['balanced','detailed']){
    assert.equal(selectSignLod(tier,16,true,16),tier);
    assert.equal(selectSignLod(tier,16.01,true,16),'baked');
    assert.equal(selectSignLod(tier,1,false,16),'culled');
  }
});

test('real Three batches compact visible detail, drop far relief and account for renderer counters',t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:404}));
  const configs=bays.map((_,i)=>setup(i)), scene=new T.Scene();
  const mask={width:3,height:2,ink:Uint8Array.of(1,0,1,1,1,1)};
  const bake={sheet:{width:atlasSize,height:atlasSize},tiles:new Map(configs.map((c,i)=>[c.id,{cells:atlasCells(i),mask}]))};
  const system=createSignageSystem(T,scene,configs,bays,bake,base);
  const camera=new T.PerspectiveCamera(58,393/612,.08,100);
  const reduced={matches:true};
  camera.position.set(-10,3,10);camera.lookAt(-10,4.78,0);camera.updateMatrixWorld();
  system.update(camera,'low',reduced,1000);
  assert.equal(scene.children.length,1);assert.equal(system.report().textureMB,21.33);
  const [faces]=scene.children;
  const renderer={info:{render:{calls:17,triangles:200}}};
  faces.onBeforeRender(renderer);renderer.info.render.calls++;renderer.info.render.triangles+=226;faces.onAfterRender(renderer);
  assert.deepEqual(system.report(),{modelsLoaded:0,signs:17,drawCalls:1,triangles:226,textureMB:21.33,tier:'low'});
  system.update(camera,'balanced',reduced,1100);
  assert.equal(scene.children.length,3);assert.ok(scene.children[1].isInstancedMesh);
  assert.ok(scene.children[1].count>0 && scene.children[1].count<17);
  const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};
  faces.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.signPulse.value,0);
  system.update(camera,'balanced',{matches:false},1200);assert.notEqual(shader.uniforms.signPulse.value,0);
  system.update(camera,'detailed',reduced,1300);
  assert.ok(scene.getObjectByName('Near sign letter relief').geometry.drawRange.count>0);assert.equal(shader.uniforms.signPulse.value,0);
  camera.lookAt(-10,3,40);camera.position.z=60;camera.lookAt(-10,3,90);camera.updateMatrixWorld();
  system.update(camera,'detailed',reduced,1400);
  assert.equal(scene.children.filter(m=>m.visible).length,1);
  assert.equal(scene.children[1].count,0);assert.equal(scene.getObjectByName('Near sign letter relief').geometry.drawRange.count,0);
  system.update(camera,'invalid',reduced,1500);
  assert.equal(scene.children.length,1);assert.equal(system.report().tier,'low');
});

test('fallback relief has capped raised ink and nine-slice hardware shares geometry across bays',()=>{
  const c=setup(0),{mount}=createShopSign(T,c,bays[0]).userData,cell=atlasCells(0).fascia;
  const g=letterGeometry(T,{width:2,height:1,ink:Uint8Array.of(1,1)},c,mount,cell);
  g.computeBoundingBox();assert.ok(g.boundingBox.max.z-g.boundingBox.min.z>.015);
  assert.equal(g.index.count,30); // one cap plus four edge walls
  const hardware=buildHardware(T,new Map(),false,17);
  assert.ok(hardware.mesh.isInstancedMesh);
  assert.equal(hardware.mesh.geometry.attributes.position.count/3,132);
  const detail=buildHardware(T,new Map(),true,17);
  assert.ok(detail.mesh.geometry.attributes.position.count>hardware.mesh.geometry.attributes.position.count);
  const node=new T.Mesh(new T.TetrahedronGeometry(1),new T.MeshStandardMaterial());
  node.material.name='brass_trim';node.updateMatrixWorld();
  const glbHardware=buildHardware(T,new Map([['sign_frame_corner',node]]),false,17);
  assert.equal(glbHardware.mesh.geometry.attributes.position.count/3,132-4*(12-4));
});

const kitAssets=json('signage/models/manifest.json').assets;
const tris=id=>kitAssets.find(a=>a.name===id).tris;

function localModels(t,missing){
  const requests=[];
  t.mock.method(globalThis,'fetch',async url=>{
    const file=url.pathname.split('/').pop();
    requests.push(file);
    if(file===missing)return new Response(null,{status:404});
    return new Response(readFileSync(new URL('signage/models/'+file,base)));
  });
  return requests;
}

test('one failed blade panel keeps its own fallback and loaded hardware shares named finishes',async t=>{
  const requests=localModels(t,'sign_blade_panel.glb');
  const modules=await loadModules(base,[...modelFiles,modelFiles[0],'../bad.glb']);
  assert.deepEqual(requests.sort(),[...modelFiles].sort());
  assert.equal(modules.size,9);assert.ok(!modules.has('sign_blade_panel'));
  const finishes=new Map();
  for(const module of modules.values())module.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(finishes.has(mesh.material.name))assert.equal(mesh.material,finishes.get(mesh.material.name));
    finishes.set(mesh.material.name,mesh.material);
  });
  const hardware=buildHardware(T,modules,true,17);
  const expected=4*tris('sign_frame_corner')+2*(tris('sign_frame_edge_h')+tris('sign_frame_edge_v'))+
    tris('sign_backplate')+tris('sign_blade_bracket')+12+3*tris('sign_downlight');
  assert.equal(hardware.mesh.geometry.attributes.position.count/3,expected);
  const accent=buildEndTrim(T,modules,1);
  const ivy=modules.get('sign_ivy_swag');
  let leafBacks=0;
  ivy.traverse(m=>{if(m.material?.side===T.DoubleSide)leafBacks+=m.geometry.index.count/3;});
  assert.equal(accent.mesh.geometry.attributes.position.count/3,3*tris('sign_timber_slat')+tris('sign_ivy_swag')+leafBacks);
});

test('cold Low, tier recovery during loading, authored crescent and café ends use the real kit',async t=>{
  const requests=localModels(t);
  const configs=[setup(0),setup(1)],scene=new T.Scene();
  const mask={width:4,height:4,ink:new Uint8Array(16).fill(1),markBounds:[.2,.1,.6,.8]};
  const bake={sheet:{width:atlasSize,height:atlasSize},tiles:new Map(configs.map((c,i)=>[c.id,{cells:atlasCells(i),mask}]))};
  const system=createSignageSystem(T,scene,configs,bays,bake,base);
  const camera=new T.PerspectiveCamera(58,1,.08,100);
  function approach(bay){
    const e=shopEntrance(bay);
    camera.position.set(e.x+8*e.normalX,3,e.z+8*e.normalZ);camera.lookAt(e.x,4.78,e.z);camera.updateMatrixWorld();
  }
  const update=tier=>system.update(camera,tier,{matches:true},0);
  approach(bays[0]);update('low');assert.deepEqual(requests,[]);
  const pending=update('balanced');update('low');await pending;
  assert.equal(system.report().tier,'low');assert.equal(scene.children.length,1);
  update('balanced');
  assert.equal(system.report().modelsLoaded,10);
  const crescent=scene.getObjectByName('Near sign letter relief');
  assert.equal(crescent.geometry.drawRange.count/3,tris('sign_logo3d_new_moon'));
  assert.ok(crescent.geometry.attributes.signSolid.array.every(id=>id===1));
  const shader={...T.ShaderLib.standard,uniforms:{}};
  crescent.material.onBeforeCompile(shader);
  const finish=json('signage/models/manifest.json').materialLibrary.emissive_letter;
  const pbr=shader.uniforms.solidPbr.value[0];
  assert.ok(Math.abs(pbr.x-finish.metallic)<1e-5 && Math.abs(pbr.y-finish.roughness)<1e-5);
  assert.equal(shader.uniforms.solidBase.value[0].getHexString(),finish.color.slice(1).toLowerCase());
  approach(bays[1]);update('detailed');
  const ends=scene.getObjectByName('Instanced sign end trim');
  assert.ok(ends.isInstancedMesh);assert.equal(ends.count,2);
  assert.ok(scene.getObjectByName('Near sign letter relief').geometry.drawRange.count>0);
  update('low');assert.equal(scene.children.length,1);
  update('balanced');assert.deepEqual(requests.sort(),[...modelFiles].sort());
});
