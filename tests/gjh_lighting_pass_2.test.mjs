import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createMallAtmosphere} from '../demos/corporate/gjh/v11/assets/mall-atmosphere.js';
import {createMallBakedLighting, createSkylightDapple} from '../demos/corporate/gjh/v11/assets/mall-baked-lighting.js';
import {createPlayerShadow} from '../demos/corporate/gjh/v11/assets/mall-player-shadow.js';
import {expandedLayout, expandedStoreArrival} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {interiorStores, worldInteriorBox} from '../demos/corporate/gjh/v11/assets/interiors/config.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {createWarmReport, prepareTier} from '../demos/corporate/gjh/v11/assets/scene-warmup.js';
import {createWorld} from '../demos/corporate/gjh/v11/assets/world.bundle.js';

const material = () => new T.MeshBasicMaterial({map:new T.Texture(),transparent:true,depthWrite:false});
const floorName = 'Mall baked floor lighting', ceilingName = 'Mall baked ceiling lighting';

test('the shared atlas stays optional while loading and its tier owns the visible planes', async () => {
  const panel={minX:-25,maxX:45,minZ:-12,maxZ:48,y:0};
  for (const phone of [true,false]) {
    const scene=new T.Scene(), pending=new Map(), prepared=[];
    const contact=material();
    const lighting=createMallBakedLighting(T,scene,{phone,contact,floors:[panel],ceilings:[{...panel,y:8}],
      load:url=>new Promise(resolve=>pending.set(url.split('/').at(-1),resolve)),
      prepareModel:async (meshes,options)=>{
        assert.deepEqual(meshes.map(mesh=>mesh.name),[floorName,ceilingName]);
        assert.ok(meshes.every(mesh=>mesh.material.map===meshes[0].material.map));
        prepared.push([meshes[0].material.map,options]);
      }
    });
    const [floor,ceiling]=scene.children;
    lighting.setTier('low');
    const low=lighting.prepare('low');
    assert.equal(floor.visible,false);
    await Promise.resolve();
    const lowMap=new T.Texture();
    pending.get('mall-light-ao-1024.webp')(lowMap);
    await low;
    assert.equal(floor.visible,true);
    assert.equal(ceiling.visible,false);
    assert.equal(floor.material.map,lowMap);
    assert.equal(lowMap.generateMipmaps,false);
    assert.equal(floor.material.customProgramCacheKey(),contact.customProgramCacheKey());
    assert.equal(floor.material.type,contact.type);
    assert.ok(floor.isInstancedMesh && ceiling.isInstancedMesh && !floor.castShadow && !ceiling.castShadow);
    assert.equal(floor.material,ceiling.material);
    assert.ok(floor.geometry.attributes.uv.getY(0)>.5);
    assert.ok(ceiling.geometry.attributes.uv.getY(0)<.5);

    lighting.setTier('balanced');
    assert.equal(ceiling.visible,true);
    const upper=lighting.prepare('detailed');
    await Promise.resolve();
    assert.equal(pending.size,phone ? 1 : 2);
    if (!phone) {
      const highMap=new T.Texture();
      pending.get('mall-light-ao-2048.webp')(highMap);
      await upper;
      assert.equal(floor.material.map,highMap);
    }
    lighting.setTier('low');
    assert.equal(floor.material.map,lowMap);
    assert.equal(ceiling.visible,false);
    assert.ok(prepared.every(([,options])=>!options.late && !options.includeInSceneSweep && options.fence));
  }
});

test('optional atlas failure leaves the world renderable through tier changes', async () => {
  const scene=new T.Scene();
  let loads=0;
  const lighting=createMallBakedLighting(T,scene,{contact:material(),floors:[],ceilings:[],load:async ()=>{
    loads++;
    throw new Error('Image unavailable');
  }});
  const world={scene,bakedLighting:lighting};
  const sweep=prepareTier({T,world,atmosphere:{interiorWarmLights:[]}}, {tier:'low',shadows:false}, createWarmReport());
  await lighting.prepare('low');
  assert.equal(loads,1,'tier entry starts optional atlas preparation eagerly');
  lighting.setTier('balanced');
  await lighting.prepare('balanced');
  assert.equal(loads,2);
  assert.ok(scene.children.every(mesh=>!mesh.visible));
  sweep.return();
});

test('the skylight decal stays hidden after an unavailable texture or failed upload', async () => {
  for (const missing of [true,false]) {
    const scene = new T.Scene(), contact = material(), texture = new T.Texture();
    let requests = 0, disposals = 0;
    texture.addEventListener('dispose',() => disposals++);
    const projection = {minX:0,maxX:9,minZ:0,maxZ:9};
    const dapple = createSkylightDapple(T,scene,{
      projection,panels:[{...projection,y:.026}],contact,
      load:async () => {
        requests++;
        if (missing) throw Error('No image');
        return texture;
      },
      prepareModel:async () => { throw Error('Upload cancelled'); }
    });
    assert.equal(dapple.prepare(),dapple.prepare());
    await dapple.prepare();
    dapple.update('detailed',false,1000);
    assert.equal(scene.children[0].visible,false);
    assert.equal(scene.children[0].material.map,contact.map);
    assert.equal(requests,1);
    assert.equal(disposals,missing ? 0 : 1);
  }
});

test('compact shadow is stable in the light image after sub-texel motion', () => {
  const scene=new T.Scene(), key=new T.DirectionalLight();
  key.position.set(-12,16,6);
  scene.add(key);
  const controller=createPlayerShadow(T,scene,key), shadow=key.shadow;
  const point=new T.Vector3(2,0,1);
  const sample=pose=>{
    controller.update(pose);
    scene.updateMatrixWorld(true);
    shadow.updateMatrices(key);
    return point.clone().applyMatrix4(shadow.matrix);
  };
  const origin=sample({x:0,y:0,z:0});
  const right=new T.Vector3().crossVectors(shadow.camera.up,key.position.clone().normalize()).normalize();
  const step=right.clone().multiplyScalar(16/1024);
  const sub=sample(step.clone().multiplyScalar(.25));
  const whole=sample(step);
  assert.ok(Math.abs(origin.x-sub.x)<1e-10 && Math.abs(origin.y-sub.y)<1e-10);
  assert.ok(Math.abs(Math.abs(origin.x-whole.x)-1/1024)<1e-10);
  const landing={x:-3,y:7.2,z:10};
  sample(landing);
  assert.ok(key.target.position.distanceTo(new T.Vector3(landing.x,landing.y,landing.z))<.012);
  assert.deepEqual(key.position.clone().sub(key.target.position).toArray(),[-12,16,6]);
  assert.deepEqual(shadow.mapSize.toArray(),[1024,1024]);
  assert.equal(shadow.camera.right-shadow.camera.left,16);
});

test('authored moods route across all 17 shops with shared IBL and the same light variants', () => {
  let pmrems=0;
  const three={...T,PMREMGenerator:class {
    fromScene() { pmrems++; return new T.WebGLRenderTarget(1,1); }
    dispose() {}
  }};
  const scene=new T.Scene(), fixed=new T.DirectionalLight();
  scene.add(fixed);
  const atmosphere=createMallAtmosphere(three,{},scene,expandedLayout.slots,{atrium:expandedLayout.atrium});
  atmosphere.restoreEnvironment();
  const colours=new Set(), intensities=new Set(), maps=new Set();
  const lights=atmosphere.interiorWarmLights;
  for (const [index,slot] of expandedLayout.slots.entries()) {
    const shop=interiorStores['S'+slot.number], {ambient:mood}=shop;
    assert.ok(mood.kelvin>=2700 && mood.kelvin<=4000);
    assert.ok(Number.isInteger(mood.accent));
    const position={x:(slot.minX+slot.maxX)/2,y:0,z:(slot.minZ+slot.maxZ)/2};
    atmosphere.update(position,index*300);
    atmosphere.update(position,index*300+150);
    assert.deepEqual(lights[0].position.toArray(),worldInteriorBox(shop,{center:mood.focus,yaw:0}).center);
    assert.ok(lights.every(light=>light.visible && light.intensity>0));
    colours.add(lights[1].color.getHex());
    intensities.add(scene.environmentIntensity);
    maps.add(scene.environment);
  }
  assert.equal(colours.size,17);
  assert.ok(intensities.size>10);
  assert.equal(maps.size,1);
  assert.equal(pmrems,3);
  atmosphere.update({x:36,y:0,z:44},5300);
  const near=scene.environmentIntensity;
  atmosphere.update({x:35.01,y:0,z:44},5500);
  assert.ok(Math.abs(scene.environmentIntensity-.58)<Math.abs(near-.58));
  atmosphere.update({x:-3,y:7.2,z:10},5700);
  assert.ok(lights.every(light=>!light.visible));
  assert.deepEqual(atmosphere.lightVariants(scene.children),[[fixed],[fixed,...lights]]);
  atmosphere.releaseEnvironment();
});

test('bundled world starts and submits expanded Low, Balanced and Detailed frames with browser stubs', async t => {
  const noop=()=>{};
  const gradient={addColorStop:noop};
  const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,
    getImageData:(_x,_y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    measureText:text=>({width:String(text).length*12})}, {get:(object,key)=>object[key] ?? noop});
  const canvas=()=>({width:1,height:1,getContext:()=>context});
  const requests = [];
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);
    requests.push(url.pathname);
    if (url.protocol==='file:' && /\.(pack|json)$/.test(url.pathname)) return new Response(await readFile(url));
    return new Response(null,{status:404});
  });
  const globals={self:globalThis, createImageBitmap:async()=>canvas(),
    location:new URL('../demos/corporate/gjh/v11/index.html',import.meta.url),window:{requestIdleCallback:noop},document:{
    createElement:canvas,querySelector:()=>null,addEventListener:noop,hidden:false
  },Image:class {
    set src(_) {queueMicrotask(()=>this.onerror?.());}
    decode() {return Promise.reject(new Error('Offline fallback'));}
  }};
  for (const [name,value] of Object.entries(globals)) {
    const before=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,value});
    t.after(()=>{if(before)Object.defineProperty(globalThis,name,before);else delete globalThis[name];});
  }
  const descriptor=()=>({setTranslation(){return this;},setRotation(){return this;}});
  const R={ColliderDesc:{cuboid:descriptor,cylinder:descriptor},RigidBodyDesc:{kinematicPositionBased:descriptor},
    Cuboid:class {},QueryFilterFlags:{EXCLUDE_FIXED:1,EXCLUDE_SENSORS:2}};
  let handle=0;
  const physics={createCollider:()=>({setRotation:noop,setEnabled(value){this.enabled=value;}}),createRigidBody:()=>({handle:handle++}),removeCollider:noop};
  const textureRequests=[];
  class TextureLoader {
    setCrossOrigin() {return this;}
    load(url,done) {const map=new T.Texture(canvas());queueMicrotask(()=>done?.(map));return map;}
    async loadAsync(url) {textureRequests.push(url);return new T.Texture(canvas());}
  }
  const three={...T,TextureLoader};
  const world=await createWorld(three,R,physics,true,async()=>{},()=> 'low',false,()=>false);
  assert.equal(requests.filter(path=>path.endsWith('/startup-assets.pack')).length,1);
  assert.deepEqual(requests.filter(path=>path.endsWith('.glb')),[], 'first frame should use only packed models');
  assert.equal(world.signage.configs.size, 17);
  assert.equal(world.interiors.groups.length, 17);
  assert.deepEqual(Object.values(world.productAssets.cans).map(({status,reason})=>reason ?? status), Array(4).fill('loaded'));
  t.after(()=>world.interiors.dispose());
  const camera=new T.PerspectiveCamera(65,1,.1,160);
  camera.position.set(10,2,45);camera.updateMatrixWorld(true);
  const pose={x:10,y:0,z:45};
  const key=world.scene.children.find(node=>node.isDirectionalLight);
  const info={autoReset:true,render:{calls:0,triangles:0},reset(){this.render.calls=this.render.triangles=0;}};
  const renderer={info,shadowMap:{autoUpdate:true,enabled:false},autoClear:true,getRenderTarget:()=>null,
    getClearColor:color=>color.set(0),getClearAlpha:()=>1,setClearColor:noop,setRenderTarget:noop,
    render(scene){scene.traverseVisible(node=>{if(node.isMesh)info.render.calls++;});}
  };
  const atmosphere=createMallAtmosphere(three,renderer,world.scene,expandedLayout.slots);
  const ambient=world.scene.children.find(node=>node.isHemisphereLight);
  const ambientBase=ambient.intensity;
  const lgArrival={...expandedStoreArrival('planned-space-14'),y:.89};
  atmosphere.update(lgArrival,0,'balanced');
  assert.ok(ambient.intensity > ambientBase,'LG fill reaches the standard entrance pose');
  atmosphere.update({...lgArrival,y:7.2},0,'balanced');
  assert.equal(ambient.intensity,ambientBase,'LG fill stays on the ground level');
  assert.equal(world.scene.getObjectByName(floorName).visible,false);
  const dapple=world.scene.getObjectByName('Atrium skylight tree shadow');
  assert.ok(dapple?.isInstancedMesh && !dapple.visible && !dapple.castShadow && !dapple.receiveShadow);
  assert.equal(world.scene.children.filter(node=>node.isLight).length,4);
  assert.equal(world.defaultExposure,.72);
  for (const [tier,shadows] of [['low',false],['balanced',false],['detailed',true]]) {
    renderer.shadowMap.enabled=shadows;
    world.updateShopLods(pose,shadows,tier,camera,700,false,false);
    await world.bakedLighting.prepare(tier);
    atmosphere.update(pose);
    atmosphere.render(camera,false);
    assert.ok(renderer.info.render.calls>0);
    assert.equal(world.scene.getObjectByName(floorName).visible,true);
    assert.equal(dapple.visible,tier!=='low');
    assert.equal(dapple.material.blending,T.AdditiveBlending);
    assert.equal(dapple.material.toneMapped,world.contact.toneMapped);
    assert.equal(dapple.material.type,world.contact.type);
    assert.equal(dapple.material.customProgramCacheKey(),world.contact.customProgramCacheKey());
    assert.equal(dapple.material.map.colorSpace,T.SRGBColorSpace);
    assert.equal(dapple.material.map.wrapS,T.RepeatWrapping);
    assert.equal(dapple.material.map.generateMipmaps,false);
    assert.equal(world.scene.getObjectByName(ceilingName).visible,tier!=='low');
    assert.equal(world.scene.getObjectByName(floorName).material.map===world.contact.map,false);
    assert.equal(world.scene.getObjectByName('Mall floor and wall light pools').visible,tier!=='low');
    const trim = world.scene.getObjectByName('Expanded storefront trim');
    assert.ok(trim.visible && trim.count > 0 && trim.geometry.hasAttribute('instanceSurface'));
    assert.equal(world.scene.children.filter(node=>node.name.startsWith('Expanded storefront')).length,2);
    assert.ok(world.scene.getObjectByName('Restroom sliding door leaves').count <= 6);
    assert.equal(world.scene.children.filter(node=>node.name.startsWith('cylinder plain')).length,1);
    assert.equal(world.scene.getObjectByName('Atrium ball')?.visible ?? false,false);
    assert.equal(Boolean(world.scene.getObjectByName('Mall tram')),false);
    if (shadows) assert.ok(key.target.position.distanceTo(new T.Vector3(pose.x,pose.y,pose.z))<.012);
    else assert.deepEqual(key.target.position.toArray(),[0,0,0]);
  }
  const map = dapple.material.map;
  world.updateShopLods(pose,false,'low',camera,700,false,false);
  const contactBatch = world.scene.getObjectByName('Mall contact shadows');
  const contact = new T.Mesh(world.plane,world.contact);
  contact.position.set(10,.05,45);
  const staticCount = contactBatch.count;
  world.drawWithPlayerContact(contact, () => {
    assert.equal(contact.visible,false);
    assert.equal(contactBatch.count,staticCount+1);
    const transform = new T.Matrix4();
    contactBatch.getMatrixAt(staticCount,transform);
    assert.ok(new T.Vector3().setFromMatrixPosition(transform).distanceTo(contact.position) < .0001);
  });
  assert.equal(contactBatch.count,staticCount);
  assert.equal(contact.visible,true);
  assert.deepEqual(map.offset.toArray(),[0,0]);
  world.updateShopLods(pose,false,'balanced',camera,700,false,false);
  assert.notDeepEqual(map.offset.toArray(),[0,0]);
  world.updateShopLods(pose,false,'detailed',camera,700,false,false,true);
  assert.deepEqual(map.offset.toArray(),[0,0]);
  assert.equal(new T.Raycaster(new T.Vector3(liftLayout.x,2,liftLayout.z),new T.Vector3(0,-1,0))
    .intersectObject(dapple).length,0,'tree shadows must leave the lift shaft clear');
  const ceiling=world.scene.getObjectByName(ceilingName);
  assert.equal(new T.Raycaster(new T.Vector3(liftLayout.x,7.3,liftLayout.z),new T.Vector3(0,1,0))
    .intersectObject(ceiling).length,0,'atlas geometry must keep the roof opening');
  world.scene.updateMatrixWorld(true);
  const paving = world.scene.getObjectByName('Mall ivory marble paving');
  assert.ok(paving.isInstancedMesh && paving.count === 1);
  assert.ok(paving.material.roughness >= .22 && paving.material.roughness <= .30);
  const deckRay = (x,z) => new T.Raycaster(new T.Vector3(x,liftLayout.upper+.5,z),
    new T.Vector3(0,-1,0),0,1).intersectObject(paving);
  assert.equal(deckRay(liftLayout.x,liftLayout.z).length,0,'marble must leave the lift shaft open');
  assert.ok(deckRay(liftLayout.slab.minX+.3,liftLayout.slab.minZ+.3).length,
    'the upper deck uses the public marble batch');
  const sky = world.scene.getObjectByName('Atrium daylight glazing');
  assert.ok(new T.Raycaster(new T.Vector3(-3,8,10),new T.Vector3(0,1,0))
    .intersectObject(sky).length,'the canopy texture faces the mall');

  assert.equal(textureRequests.filter(url=>url.includes('mall-light-ao')).length,2);
  assert.equal(textureRequests.filter(url=>url.includes('mall-skylight-dapple-512.png')).length,1);
});
