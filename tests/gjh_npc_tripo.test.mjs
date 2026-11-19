import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createLocomotionContinuity} from '../demos/corporate/gjh/v11/assets/character.js';
import {createCharacterTripo} from '../demos/corporate/gjh/v11/assets/character-tripo.js';
import {cloneNpcRig,createNpcSystem,loadNpcSystem,npcLimit} from '../demos/corporate/gjh/v11/assets/npcs.js';
import {loadModularLooks,validateManifest} from '../demos/corporate/gjh/v11/assets/crowd.js';
import {loadTripoNpc,tripoNpcClips} from '../demos/corporate/gjh/v11/assets/npc-tripo.js';

const clipNames = ['idle','walk','run','sit','wave','nod'];
const player = {x:0,y:0,z:10};
const bench = {id:'bench',x:-7,y:.015,z:7,exitX:-7,exitZ:5.8,floor:0,angle:0};

function model(name) {
  const scene = new T.Group(), hips = new T.Bone(), toe = new T.Bone();
  hips.name = 'mixamorigHips';
  toe.name = 'mixamorigLeftToeBase';
  toe.position.z = .1;
  hips.add(toe); scene.add(hips);
  const geometry = new T.BoxGeometry(1,1,1), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));
  const weights = new Float32Array(count*4);
  for (let i=0; i<weights.length; i+=4) weights[i]=1;
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const mesh = new T.SkinnedMesh(geometry,new T.MeshBasicMaterial({map:new T.Texture()}));
  mesh.name = name; scene.add(mesh); mesh.bind(new T.Skeleton([hips,toe]));
  const animations = clipNames.map(clip => new T.AnimationClip(clip,1,[
    new T.VectorKeyframeTrack('mixamorigHips.position',[0,.5,1],{
      idle:[0,0,0, 0,.1,0, 0,0,0],
      walk:[0,0,0, .25,.2,.8, .4,0,1],
      sit:[0,.5,0, 0,.3,0, 0,.2,0]
    }[clip] || [0,0,0, 0,0,0, 0,0,0])
  ]));
  return {scene,mesh,animations};
}

function fixture(options={}) {
  const scene = new T.Scene(), source = model('visitor');
  const system = createNpcSystem(T,{scene,source,R:{Capsule:class {}},
    physics:{intersectionWithShape:()=>null},...options});
  return {scene,system,source};
}
const boys = scene => scene.children.filter(root => root.getObjectByName('boy'));
const admit = (system,calls=0) => { for (let i=0; i<48; i++) system.admit(calls); };
const loader = (high,low) => signal => loadTripoNpc(signal,async level => level ? low : high);

test('Tripo clip names are exact and walk root drift is removed without mutating the source',()=>{
  const {animations} = model('boy');
  const clips = tripoNpcClips(animations);
  assert.deepEqual(Object.keys(clips),clipNames);
  assert.equal(clips.sit,animations.find(clip=>clip.name==='sit'));
  assert.deepEqual(Array.from(clips.walk.tracks[0].values,v=>+v.toFixed(2)),[0,0,0,.05,.2,.3,0,0,0]);
  assert.equal(animations.find(clip=>clip.name==='walk').tracks[0].values.at(-1),1);
  for (const name of clipNames) assert.equal(tripoNpcClips(animations.filter(clip=>clip.name!==name)),null);
});

test('a single Tripo walker shares the usual desktop and mobile tier budgets',async()=>{
  for (const mobile of [false,true]) for (const tier of ['low','balanced','detailed']) {
    const {scene,system} = fixture({tier,mobile});
    system.update(.016,player); admit(system);
    const existing = scene.children.slice();
    await system.loadBoy(loader(model('boy'),model('boy')));
    system.update(.016,player); admit(system);
    const cap = npcLimit({tier,mobile});
    assert.equal(system.state.active,cap);
    assert.equal(system.state.visible,cap);
    assert.deepEqual(scene.children,existing);
    assert.equal(boys(scene).length,1);
    assert.equal(scene.children.filter(root=>!!root.getObjectByName('visitor')).length,cap-1);
    system.admit(199);
    assert.ok(system.state.visible<=1);
    assert.ok(system.state.drawCalls+199<=200);
    system.update(.016,{x:500,y:0,z:500});
    assert.equal(system.state.active,0);
    system.update(.016,player);
    assert.equal(boys(scene).length,1);
    system.dispose();
  }
});

test('Tripo LOD shares one posed rig and material, and reduced motion freezes idle sway',async()=>{
  const {scene,system} = fixture();
  const high = model('boy'), low = model('boy');
  const lowGeometry = low.mesh.geometry;
  low.animations = [];
  let disposed = 0;
  for (const resource of [high.mesh.geometry,high.mesh.material,high.mesh.material.map,lowGeometry,low.mesh.material,low.mesh.material.map]) {
    resource.addEventListener('dispose',()=>disposed++);
  }
  await system.loadBoy(loader(high,low));
  system.update(.1,player,true);
  const [root] = boys(scene), mesh = root.getObjectByName('boy');
  const hips = mesh.skeleton.bones[0], skeleton = mesh.skeleton, rig = root.children[0].children[0];
  assert.deepEqual(rig.scale.toArray(),[1.6,1.6,1.6]);
  assert.equal(mesh.geometry,high.mesh.geometry);
  assert.equal(mesh.material,high.mesh.material);
  assert.equal(disposed,2); // The unused LOD texture and material can be dropped immediately.
  const positionAt = metres => ({x:root.position.x+metres,y:0,z:root.position.z});
  system.update(.1,positionAt(13),true);
  assert.equal(mesh.geometry,lowGeometry);
  assert.equal(mesh.skeleton,skeleton);
  system.update(.1,positionAt(11),true);
  assert.equal(mesh.geometry,lowGeometry);
  assert.equal(hips.position.y,0);
  system.update(.1,positionAt(9));
  assert.equal(mesh.geometry,high.mesh.geometry);
  assert.ok(hips.position.y>0);
  let moving = false;
  for (let i=0; i<100 && !moving; i++) {
    const previous = root.position.clone();
    system.update(.1,player,true);
    const direction = root.position.clone().sub(previous);
    if (direction.lengthSq()===0) continue;
    const toeDirection = mesh.skeleton.bones[1].getWorldPosition(new T.Vector3())
      .sub(hips.getWorldPosition(new T.Vector3())).normalize();
    assert.ok(toeDirection.dot(direction.normalize())>.99);
    moving = true;
  }
  assert.ok(moving);
  system.dispose(); system.dispose();
  assert.equal(disposed,6);
});

test('a Tripo seat occupant holds the sit pose, faces the approach and yields to the player',async()=>{
  const {scene,system} = fixture({seats:[bench],tier:'low',mobile:true});
  await system.loadBoy(loader(model('boy'),null));
  system.update(.1,player);
  const [sitter] = boys(scene), hips = sitter.getObjectByName('mixamorigHips');
  assert.deepEqual(system.occupiedSeatIds,['bench']);
  assert.ok(Math.abs(hips.position.y-.2)<.00001);
  const toe = sitter.getObjectByName('mixamorigLeftToeBase');
  assert.ok(toe.getWorldPosition(new T.Vector3()).z < hips.getWorldPosition(new T.Vector3()).z);
  for (let i=0; i<210; i++) system.update(.1,player);
  assert.equal(boys(scene)[0],sitter);
  assert.equal(system.releaseSeat('bench'),true);
  system.update(.1,{...player,seatId:'bench'});
  assert.deepEqual(system.occupiedSeatIds,[]);
  assert.ok(!scene.children.includes(sitter));
  system.dispose();
});

test('load failure or missing clip keeps the base crowd and does not retry per frame',async()=>{
  for (const missingClip of [false,true]) {
    const {scene,system} = fixture();
    let attempts = 0, disposed = 0;
    const high = model('boy');
    high.animations.pop();
    high.mesh.geometry.addEventListener('dispose',()=>disposed++);
    await system.loadBoy(signal=>loadTripoNpc(signal,async level=>{
      attempts++;
      if (level || !missingClip) throw new Error('unavailable');
      return high;
    }));
    for (let i=0; i<12; i++) system.update(.1,player);
    assert.equal(boys(scene).length,0);
    assert.equal(system.state.active,4);
    assert.equal(attempts,2);
    assert.equal(disposed,Number(missingClip));
    system.dispose();
  }
});

test('disabled NPCs skip the optional load, and Tripo material passes count towards admission',async()=>{
  const {system,scene} = fixture({enabled:false});
  let requested = false;
  await system.loadBoy(()=>{requested=true;});
  system.update(.1,player);
  assert.equal(requested,false);
  assert.equal(scene.children.length,0);
  system.setQuality({enabled:true});
  const high = model('boy');
  high.mesh.material.side = T.DoubleSide;
  high.mesh.material.transparent = true;
  await system.loadBoy(loader(high,null));
  system.update(.1,player); admit(system);
  assert.equal(system.state.callsPerNpc,2);
  assert.equal(system.admit(199),0);
  assert.equal(system.admit(198),0); // Readmission requires the usual growth margin.
  admit(system,194);
  assert.equal(system.state.visible,1);
  assert.equal(system.state.drawCalls,2);
  system.dispose();
});

test('an incompatible LOD leaves the high geometry in service and late models are disposed',async()=>{
  const {scene,system} = fixture();
  const high = model('boy'), low = model('boy');
  low.mesh.skeleton.bones.reverse();
  let disposed = 0;
  low.mesh.geometry.addEventListener('dispose',()=>disposed++);
  await system.loadBoy(loader(high,low));
  system.update(.1,player);
  const [root] = boys(scene);
  system.update(.1,{x:root.position.x+13,y:0,z:root.position.z});
  assert.equal(root.getObjectByName('boy').geometry,high.mesh.geometry);
  assert.equal(disposed,1);
  system.dispose();

  const {system:closing} = fixture();
  const late = model('boy');
  late.mesh.geometry.addEventListener('dispose',()=>disposed++);
  let finish;
  const pending = closing.loadBoy(signal=>loadTripoNpc(signal,level=>level ? null : new Promise(resolve=>{finish=resolve;})));
  await Promise.resolve(); await Promise.resolve();
  closing.dispose();
  finish(late);
  await pending;
  assert.equal(disposed,2);
});

test('the shipped Tripo visitor and boy coexist with the separately loaded V2 crowd',async t=>{
  const assets = new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
  const wardrobe = JSON.parse(await readFile(new URL('chibi-crowd/manifest.json',assets),'utf8'));
  const files = ['gjh-tripo-visitor.glb','gjh-tripo-visitor-lod1.glb','gjh-mall-visitor-v2.glb',
    'gjh-tripo-npc-boy.glb','gjh-tripo-npc-boy-lod1.glb',
    ...['manifest.json','hand_gestures.glb','motion-clips.glb',...wardrobe.modules.map(module=>module.file)].map(file=>'chibi-crowd/'+file)];
  const models = new Map(await Promise.all(files.map(async name=>[name,await readFile(new URL(name,assets))])));
  const globals = {
    fetch: async url=>{
      const data = models.get(new URL(url).pathname.split('/assets/').at(-1));
      return data ? new Response(data) : new Response(null,{status:404});
    },
    self: globalThis,
    matchMedia: ()=>({matches:false}),
    // Node decodes the GLBs and their animations with placeholder image data.
    createImageBitmap: async ()=>({width:1,height:1})
  };
  const originals = Object.fromEntries(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.assign(globalThis,globals);
  let visitor, system;
  t.after(()=>{
    system?.dispose();
    visitor?.dispose();
    for (const [key,descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  });

  const scene = new T.Scene();
  visitor = await createCharacterTripo(T,createLocomotionContinuity);
  scene.add(visitor.visual);
  system = await loadNpcSystem(T,{scene,R:{Capsule:class {}},physics:{intersectionWithShape:()=>null}});
  system.update(.016,player); admit(system,120);
  const crowd = scene.children.slice(1);
  assert.equal(crowd.length,4);
  assert.equal(system.state.visible,4);

  await system.loadBoy();
  system.update(.016,player); admit(system,120);
  const meshName = 'tripo_node_1c818c0d';
  const variants = crowd.filter(root=>root.getObjectByName(meshName));
  assert.deepEqual(scene.children,[visitor.visual,...crowd]);
  assert.equal(visitor.state.model,'gjh-tripo-visitor');
  assert.equal(variants.length,1);
  const [boy] = variants;
  const mesh = boy.getObjectByName(meshName);
  assert.equal(mesh.geometry.index.count/3,6313);
  system.update(.016,{x:boy.position.x+13,y:0,z:boy.position.z});
  assert.equal(mesh.geometry.index.count/3,2630);
  system.setQuality({tier:'low',mobile:true});
  let pending;
  system.enableModular(signal=>{
    pending=loadModularLooks(signal,{requireClothing:false});
    return pending;
  });
  system.update(.016,player);
  assert.equal(system.state.modular.status,'deferred');
  assert.equal(system.state.active,1);
  system.setQuality({tier:'detailed',mobile:false});
  system.update(.016,player);
  await Promise.resolve();
  const looks = await pending;
  await new Promise(resolve=>setImmediate(resolve));
  const sample = looks.createLook(1,cloneNpcRig), repeated = looks.createLook(1,cloneNpcRig);
  const other = looks.createLook(2,cloneNpcRig);
  assert.deepEqual([sample.appearance,sample.tint,sample.variation],[repeated.appearance,repeated.tint,repeated.variation]);
  assert.notEqual(sample.variation,other.variation);
  for (const look of [sample,repeated,other]) {
    // Every modular NPC is dressed: a top (a dress also covers the bottom), shoes and hair on the neutral body.
    const {body:bodyId,hair,top,bottom,shoes}=look.appearance;
    assert.equal(bodyId,'neutral-body');
    assert.ok(hair?.startsWith('hair-')&&top?.startsWith('top-')&&shoes==='shoes-sneakers',JSON.stringify(look.appearance));
    assert.equal(bottom!==undefined,top!=='top-dress',JSON.stringify(look.appearance));
    assert.ok(look.variation>=.95 && look.variation<=1.05);
    assert.ok(look.triangles>9512 && look.triangles<=20000,String(look.triangles));
    const bodyMesh = look.avatar.getObjectByName('Base_Body');
    const skinned = [];
    look.avatar.traverse(node=>{if(node.isSkinnedMesh)skinned.push(node);});
    assert.ok(skinned.length>=4,'body, hair, shoes and clothing are separate skinned meshes');
    for (const mesh of skinned) assert.equal(mesh.skeleton,bodyMesh.skeleton);
    bodyMesh.skeleton.dispose();
    look.materials.forEach(material=>material.dispose());
  }
  assert.equal(sample.avatar.getObjectByName('Base_Body').geometry,repeated.avatar.getObjectByName('Base_Body').geometry);
  const clips = new Set();
  const started = performance.now();
  for (let i=0; i<600; i++) {
    system.update(1/60,player);
    system.admit(120);
    for (const actor of system.state.modular.active) clips.add(actor.clip);
  }
  const crowdState = system.state;
  assert.ok(crowdState.modular.active.length>=2);
  assert.ok(crowdState.modular.active.every(actor=>actor.time>9));
  for (const clip of ['walk','idle','wave','nod']) assert.ok(clips.has(clip), [...clips]);
  t.diagnostic(JSON.stringify({simulationTicks:600, elapsedMs:+(performance.now()-started).toFixed(2),
    active:crowdState.active,modular:crowdState.modular.active.length,admitted:crowdState.admitted,
    callsPerModular:2,conservativeCallsPerNpc:crowdState.callsPerNpc}));
  system.update(.016,player,true);
  assert.ok(system.state.modular.active.every(actor=>!['wave','nod'].includes(actor.clip)));
  system.setQuality({tier:'low',mobile:true});
  system.update(.016,player);
  assert.equal(system.state.modular.active.length,0);
  assert.equal(system.state.active,1);
  assert.equal(system.state.totalCallCap,200);
  system.admit(199);
  assert.ok(199+system.state.drawCalls<=200);
  system.dispose();
  assert.deepEqual(scene.children,[visitor.visual]);
});

test('invalid or unavailable modular assets keep existing visitors in service',async()=>{
  const scene = new T.Scene();
  let failures = 0;
  const system = createNpcSystem(T,{scene,source:model('fallback'),R:{Capsule:class{}},
    physics:{intersectionWithShape:()=>null},onModularFallback:()=>failures++});
  assert.throws(()=>validateManifest({version:1,seed:1,modules:[{id:'unreviewed',slot:'body',status:'draft'}]}));
  system.enableModular(()=>Promise.reject(new Error('Missing manifest')));
  system.update(1/60,player);
  await new Promise(resolve=>setImmediate(resolve));
  system.update(1/60,player);
  admit(system,120);
  assert.equal(system.state.modular.status,'unavailable');
  assert.equal(system.state.visible,4);
  assert.equal(failures,1);
  system.dispose();
});
