import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {loadInteriorActions} from '../demos/corporate/gjh/v11/assets/interiors/config.js';
import {audit,capsule,distance,floorGrid,obstacles,programme,studioBoxes} from '../scripts/gjh_interiors/sweep.mjs';

const plan=JSON.parse(readFileSync(programme));
const schema=JSON.parse(readFileSync(new URL('../docs/gjh-v11-interior-program.schema.json',import.meta.url)));
const [moon,mili,gogo]=plan.stores;

// The programme uses this deliberately small JSON Schema vocabulary so validation
// stays available on a clean Node install. Reject unknown assertions when it grows.
function validate(value, schema, path) {
  for (const [key,rule] of Object.entries(schema)) {
    switch (key) {
      case '$schema': case 'title': break;
      case 'type':
        assert.equal(Array.isArray(value)?'array':typeof value,rule,path);
        assert.notEqual(value,null,path);
        break;
      case 'const': assert.deepEqual(value,rule,path); break;
      case 'enum': assert(rule.includes(value),path); break;
      case 'pattern': assert(new RegExp(rule).test(value),path); break;
      case 'minLength': case 'minItems': assert(value.length>=rule,path); break;
      case 'maxItems': assert(value.length<=rule,path); break;
      case 'exclusiveMinimum': assert(value>rule,path); break;
      case 'uniqueItems': if (rule) assert.equal(new Set(value).size,value.length,path); break;
      case 'required': for (const name of rule) assert(Object.hasOwn(value,name),path+'.'+name); break;
      case 'properties':
        for (const [name,child] of Object.entries(rule)) if (Object.hasOwn(value,name)) validate(value[name],child,path+'.'+name);
        break;
      case 'additionalProperties':
        for (const [name,child] of Object.entries(value)) if (!schema.properties?.[name]) validate(child,rule,path+'.'+name);
        break;
      case 'items': value.forEach((child,i)=>validate(child,rule,path+'.'+i)); break;
      default: assert.fail('Unsupported schema keyword '+key);
    }
  }
}

test('all layout instances satisfy the published schema and produce the installed runtime projections',async()=>{
  validate(plan,schema,'programme');
  execFileSync('python3',['scripts/gjh_interiors/build_layout.py','--check']);
  assert.equal(new Set(plan.stores.map(s=>s.slot)).size,17);
  assert.deepEqual(plan.kitLimits,{low:[2800,7],balanced:[4600,8],detailed:[7300,10]});
  const ids=new Set();
  for (const shop of plan.stores) {
    const loaded=await loadInteriorActions(shop.slot);
    assert.deepEqual(loaded.map(i=>[i.id,i.action,i.standing]),shop.items.map(i=>[i.id,i.action,i.standing]));
    assert(shop.items.some(i=>i.id===shop.focal));
    for (const item of shop.items) {
      assert(!ids.has(item.id),item.id);
      ids.add(item.id);
      assert(shop.zones[item.zone] && shop.anchors[item.anchor],item.id);
    }
  }
});

test('door, operation, focal and return routes clear the actual studio and kit proxies',async()=>{
  const studio=await studioBoxes();
  for (const shop of plan.stores) assert.deepEqual(audit(shop,studio),[],shop.slot);
});

test('historic MILI plate and New Moon pickup fail the same clearance checks',()=>{
  const oldMili=structuredClone(mili), plate=oldMili.items.find(i=>i.socket==='plate');
  plate.xyz[1]=1.165;
  assert.equal(oldMili.anchors[plate.anchor].xyz[1],1.22);
  assert(audit(oldMili,[]).some(([id,issue])=>id===plate.id && issue==='unsupported'));
  const oldMoon=structuredClone(moon), shelf=oldMoon.items.find(i=>i.socket==='shelves');
  shelf.xyz[0]=-3.63;
  shelf.size[0]=2.4;
  shelf.standing=[shelf.xyz[0]+.21,-2.635];
  // The historical report used a 0.30 m player. S0 sweeps with 0.28 m.
  assert(Math.abs(distance(shelf.standing,shelf)-.30-.04)<1e-8);
  const issues=audit(oldMoon,[]);
  assert(issues.some(([id,issue])=>id===shelf.id && issue.startsWith('pick-up clearance')));
  assert(issues.some(([id,issue])=>id===shelf.id && issue==='inside wall'));
  for (const i of moon.items.filter(i=>i.socket==='shelves')) assert(distance(i.standing,i)-capsule>=.25);
});

test('GOGO coffee table intersects both planned paths and reproduces the 1.63 m Rapier stop',async t=>{
  const table={xyz:[0,0,.5],size:[1.61,.875,1.61]};
  const oldGrid=floorGrid(gogo,[...obstacles(gogo),table]);
  for (const [a,b] of gogo.additional_clearance_segments) assert(!oldGrid.edge(a,b,capsule));
  const original=globalThis.fetch;
  t.mock.method(globalThis,'fetch',(url,options)=>String(url).endsWith('rapier_bg.wasm')
    ? new Response(readFileSync(new URL('../demos/corporate/gjh/v11/vendor/rapier_bg.wasm',import.meta.url)),{headers:{'Content-Type':'application/wasm'}})
    : original(url,options));
  await R.init();
  const world=new R.World({x:0,y:0,z:0});
  try {
    const block=world.createCollider(R.ColliderDesc.cuboid(.805,.4375,.805).setTranslation(0,.4375,.5));
    const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    const player=world.createCollider(R.ColliderDesc.capsule(.55,.30),body);
    const controller=world.createCharacterController(.025);
    function walk() {
      body.setTranslation({x:0,y:.875,z:2.55},true);
      world.step();
      for (let step=0;step<111;step++) {
        controller.computeColliderMovement(player,{x:0,y:0,z:-.05});
        const at=body.translation(),delta=controller.computedMovement();
        body.setNextKinematicTranslation({x:at.x,y:at.y,z:at.z+delta.z});
        world.step();
      }
      return body.translation().z;
    }
    assert(Math.abs(walk()-1.63)<.002);
    world.removeCollider(block,true);
    assert(Math.abs(walk()+3)<.002);
  } finally {world.free();}
});

test('New Moon validates the native GLB, scales all four cabinets and retains the stocked targets',async t=>{
  const T=await import('../demos/corporate/gjh/v11/vendor/three.module.min.js');
  globalThis.location=new URL('https://example.test/');
  globalThis.self=globalThis;
  globalThis.createImageBitmap=async()=>({width:512,height:512,close() {}});
  t.after(()=>{delete globalThis.location;delete globalThis.self;delete globalThis.createImageBitmap;});
  const original=globalThis.fetch;
  t.mock.method(globalThis,'fetch',async(input,options)=>{
    const url=new URL(input.url ?? input);
    return url.protocol==='file:' ? new Response(readFileSync(url)) : original(input,options);
  });
  const {addProducts}=await import('../demos/corporate/gjh/v11/assets/products.js');
  const scene=new T.Scene();
  const display=await addProducts(T,scene,new Map(),new T.MeshStandardMaterial());
  assert.equal(display.assets.shelf.status,'loaded',display.assets.shelf.reason);
  assert.equal(display.assets.totalInstances,204);
  const shelves=moon.items.filter(i=>i.socket==='shelves');
  for (const [index,cabinet] of shelves.entries()) {
    const shelf=display.shelves[index];
    assert.equal(shelf.id,cabinet.targetId);
    assert(Math.abs(shelf.max.x-shelf.min.x-cabinet.size[0])<1e-7);
    assert.deepEqual([shelf.pickup.x,shelf.pickup.z],cabinet.standing.map((v,k)=>v+moon.frame.world_origin_m[k*2]));
    assert(display.reserveProduct(shelf.id));
  }
});
