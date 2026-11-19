import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {INTERIOR_ADDITIONS} from '../demos/corporate/gjh/v11/assets/interior-additions-registry.js';
import {INTERIOR_PILOT} from '../demos/corporate/gjh/v11/assets/interior-pilot-registry.js';

const assets = new URL('../demos/corporate/gjh/v11/assets/', import.meta.url);
const startup = JSON.parse(readFileSync(new URL('../../../../../data/gjh-startup-assets.json', assets), 'utf8'));
const glbJson = buffer => {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString('utf8', 20, 20 + length));
};

test('interior additions match their files and the strict static loader rules', () => {
  const entries = Object.values(INTERIOR_ADDITIONS);
  assert.equal(entries.length, 11);
  const ids = new Set(entries.map(entry => entry.asset_id));
  assert.equal(ids.size, entries.length);
  for (const entry of entries) {
    assert.ok(!Object.values(INTERIOR_PILOT).some(pilot => pilot.asset_id === entry.asset_id), `${entry.asset_id} reuses a pilot id`);
    const data = readFileSync(new URL(entry.file, assets));
    assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256, entry.file);
    assert.equal(data.length, entry.bytes);
    assert.ok(data.length <= 256000, `${entry.file} is larger than 250 KB`);
    const json = glbJson(data);
    for (const key of ['images', 'textures', 'animations', 'skins']) assert.equal((json[key] ?? []).length, 0, `${entry.file} has ${key}`);
    assert.ok(!(json.buffers ?? []).some(buffer => buffer.uri) && !(json.extensionsRequired ?? []).length);
    assert.ok(json.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0) <= 16);
    const root = json.nodes.find(node => node.name === entry.asset_id);
    assert.equal(root?.extras?.asset_id, entry.asset_id);
    assert.equal(entry.dimensions_m.length, 3);
    // The owner confirmed redistribution on 2026-11-20; accept the confirmed wording or the older unspecified one.
    assert.match(entry.rights, /unspecified|redistribution confirmed by the owner/);
  }
});

test('sliced additions stay outside the mandatory startup transfer', () => {
  for (const entry of Object.values(INTERIOR_ADDITIONS)) {
    assert.equal(startup.includes(entry.file), false, entry.file);
  }
});

import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createInteriorAdditions} from '../demos/corporate/gjh/v11/assets/interior-additions.js';
import {audit, distance, obstacles, programme, studioBoxes} from '../scripts/gjh_interiors/sweep.mjs';
import {footprintGap} from '../scripts/gjh_interiors/placement.mjs';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {expandedLayout} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {NPC_ROUTES} from '../demos/corporate/gjh/v11/assets/npcs.js';
import {tramRoute, sampleTramEnvelopes} from '../demos/corporate/gjh/v11/assets/tram-layout.js';
import {tramLanding} from '../demos/corporate/gjh/v11/assets/tram-ride.js';

const entries = Object.values(INTERIOR_ADDITIONS);
function worldBox(entry) {
  const {xyz,yaw_deg} = entry.placement;
  const matrix = new T.Matrix4().makeRotationY(yaw_deg*Math.PI/180).setPosition(...xyz);
  const bounds = new T.Box3(new T.Vector3(...entry.bounds_min),new T.Vector3(...entry.bounds_max)).applyMatrix4(matrix);
  const centre = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3()).toArray();
  return {xyz:[centre.x,bounds.min.y,centre.z],size};
}

test('shop additions retain supported footprints, 1.2 m routes and turning circles', async () => {
  const {stores} = JSON.parse(readFileSync(programme)), studio = await studioBoxes();
  for (const e of entries.filter(e=>/^S\d+$/.test(e.placement.support))) {
    const shop = stores.find(s=>s.slot===e.placement.support);
    assert.ok(Number(shop.slot.slice(1))>=6);
    const b = worldBox(e), [wx,y,wz] = b.xyz, [ox,,oz] = shop.frame.world_origin_m;
    const yaw = shop.frame.yaw_world_deg*Math.PI/180, c = Math.cos(yaw), s = Math.sin(yaw);
    const local = {xyz:[(wx-ox)*c-(wz-oz)*s,y,(wx-ox)*s+(wz-oz)*c],size:b.size,yawDeg:-shop.frame.yaw_world_deg};
    assert.equal(y,shop.frame.floor_surface_y_m);
    const [xmin,xmax,zmin,zmax] = shop.frame.world_bounds_xz_m;
    assert.ok(wx-b.size[0]/2>xmin && wx+b.size[0]/2<xmax && wz-b.size[2]/2>zmin && wz+b.size[2]/2<zmax);
    for (const other of [...obstacles(shop,studio),...shop.items]) {
      if (other.xyz[1] >= y+b.size[1] || other.xyz[1]+other.size[1] <= y) continue;
      assert.ok(footprintGap(local,other)>=.15,e.kind+' overlaps '+(other.id ?? 'fixed studio'));
    }
    shop.retainedObstacles = [...(shop.retainedObstacles ?? []),local];
  }
  for (const shop of stores) assert.deepEqual(audit(shop,studio),[],shop.slot);
});

test('public placements touch their actual supports and clear fixed fixtures and circulation', () => {
  const fixed = [];
  const fixture = (x,z,w,d) => fixed.push({xyz:[x,0,z],size:[w,2,d]});
  for (const lounge of atriumLayout.lounges) {
    for (const p of lounge.seats) fixture(p.x,p.z,2.5,.85);
    for (const p of lounge.planters) fixture(p.x,p.z,.7,.7);
    fixture(lounge.table.x,lounge.table.z,.58,.58);
  }
  fixture(liftLayout.desk.x,liftLayout.desk.z,2.88,.961);
  fixture(liftLayout.directory.x,liftLayout.directory.z,.96,.68);
  for (const x of [1.87,18.13]) for (const z of [19.05,24.8,30.55,36.3,42.05,47.55]) fixture(x,z,.76,.83);
  fixture(liftLayout.x,liftLayout.z,liftLayout.shaft.maxX-liftLayout.shaft.minX,liftLayout.shaft.maxZ-liftLayout.shaft.minZ);
  const boxes = entries.filter(e=>!/^S\d+$/.test(e.placement.support)).map(e=>[e,worldBox(e)]);
  // Walk a 1.2 m aisle to each public grouping, including the ottoman's exit
  // and both sides of the coat-check desk. Endpoints admit a 1.5 m turn.
  const walkingBoxes = [...fixed,...boxes.map(([,box])=>box).filter(b=>b.xyz[1]<1.8)];
  const approaches = [
    [[-8,25.6],[-4,25.6]], [[22,18.8],[22,20.15]], [[26,18.8],[26,20.3]],
    [[8.5,44.45],[5.9,44.45]], [[21.25,42.4],[21.25,43.3]],
    [[23,46.025],[21.25,46.025]], [[16.75,44.75],[18.13,44.75]]
  ];
  for (const [[ax,az],[bx,bz]] of approaches) for (let i=0;i<=100;i++) {
    const at = [ax+(bx-ax)*i/100,az+(bz-az)*i/100];
    for (const box of walkingBoxes) assert.ok(distance(at,box)>=(i===100 ? .75 : .6)-1e-7,'clearance at '+at);
  }
  for (const [entry,b] of boxes) {
    const {support} = entry.placement, [x,y,z] = b.xyz, [w,h,d] = b.size;
    const contains = (xmin,xmax,zmin,zmax) => x-w/2>=xmin && x+w/2<=xmax && z-d/2>=zmin && z+d/2<=zmax;
    if (support.endsWith('-lounge-rug')) {
      const lounge = atriumLayout.lounges.find(l=>support.startsWith(l.id));
      assert.ok(contains(lounge.x-2.9,lounge.x+2.9,lounge.z-3.9,lounge.z+3.9));
      assert.equal(y,.016);
    } else if (support === 'concourse') {
      assert.ok(contains(10-49.85/2,10+49.85/2,24-47.85/2,24+47.85/2));
      assert.equal(y,-.012);
    } else if (support === 'entrance-wall') {
      assert.ok(Math.abs(z+d/2-47.85)<.001 && x-w/2>16 && x+w/2<45 && y>0 && y+h<6.6);
    } else {
      assert.equal(support,'arcade-beam');
      assert.ok(Math.abs(y+h-4.797)<.001 && Math.abs(entry.placement.xyz[0]-18.13)<.001 && Math.abs(z-33.3)<14.4);
    }
    for (const slot of expandedLayout.slots) assert.ok(x+w/2<=slot.minX || x-w/2>=slot.maxX || z+d/2<=slot.minZ || z-d/2>=slot.maxZ);
    assert.ok(y+h < liftLayout.upper,'ground props must clear the upper POI route');
    for (const [other,box] of boxes) {
      if (entry===other || y>=box.xyz[1]+box.size[1] || y+h<=box.xyz[1]) continue;
      assert.ok(footprintGap(b,box)>=.15,entry.kind+' / '+other.kind);
    }
    if (y>2.65) continue;
    for (const box of fixed) assert.ok(footprintGap(b,box)>=.15);
    for (const p of [liftLayout.exit,liftLayout.directory,liftLayout.desk,expandedLayout.entrance,tramLanding]) {
      assert.ok(distance([p.x,p.z],b) >= (p.radius ?? .75));
    }
    for (const lounge of atriumLayout.lounges) for (const seat of lounge.seats)
      assert.ok(distance([seat.x,seat.z-1.2],b)>=.75);
    const routes = NPC_ROUTES.expanded;
    for (const [index,[ax,az]] of routes.entries()) {
      const [bx,bz] = routes[(index+1)%routes.length];
      for (let i=0;i<=100;i++) assert.ok(distance([ax+(bx-ax)*i/100,az+(bz-az)*i/100],b)>=.6);
    }
    for (let t=0;t<tramRoute.length;t+=.15) for (const tram of sampleTramEnvelopes(tramRoute,t)) {
      if (y>=tram.top || y+h<=tram.bottom) continue;
      assert.ok(footprintGap(b,{xyz:[tram.x,tram.bottom,tram.z],size:[tram.width,tram.top-tram.bottom,tram.length],
        yawDeg:tram.heading*180/Math.PI})>=.15);
    }
  }
});

test('offline smoke loads real GLBs, warms before attach, and switches rendered triangles and colliders together', async t => {
  const loaded = [], warmed = [], proxies = [], seats = [], scene = new T.Scene();
  t.mock.method(globalThis,'fetch',async url => {
    const name = new URL(url).pathname.split('/').pop();
    loaded.push(name);
    return new Response(readFileSync(new URL(name,assets)));
  });
  const model = createInteriorAdditions(T,{scene,seats,tier:()=> 'low',slice:()=>Promise.resolve(),
    collider(...args) {
      const proxy = {args,handle:proxies.length,setEnabled(value){this.enabled=value;}};
      proxies.push(proxy);
      return proxy;
    },async prepareModel(mesh,options) { warmed.push(mesh); assert.ok(options.fence); assert.equal(mesh.parent,null); assert.ok(mesh.geometry.index.count>0); }});
  const allNear = new Map([[8,true],[13,true],[17,true]]);
  for (const tier of ['low','balanced','detailed','low']) {
    model.update(tier,{},allNear);
    const expected = entries.filter(e=>tier!=='low' || e.minimum_tier==='low');
    for (let i=0;i<200 && expected.some(e=>model.state[e.kind].status!=='loaded');i++)
      await new Promise(resolve=>setTimeout(resolve,2));
    model.update(tier,{},allNear);
    assert.equal(proxies.filter(p=>p.enabled).length,expected.length);
    const draws = scene.children.filter(m=>m.visible);
    assert.ok(draws.every(mesh=>warmed.includes(mesh)));
    const triangles = draws.reduce((n,m)=>n+m.geometry.drawRange.count/3,0);
    assert.equal(triangles,expected.reduce((n,e)=>n+e.triangles,0));
    assert.ok(draws.length<=2 && triangles<=(tier==='low'?2500:14000));
    if (tier==='low' && loaded.length<11) assert.deepEqual(loaded.sort(),expected.map(e=>e.file).sort());
    else assert.equal(loaded.length,11);
    for (const e of expected) {
      assert.equal(model.state[e.kind].status,'loaded');
      const {xyz:[x,y,z],size:[w,h,d]} = worldBox(e);
      assert.deepEqual(proxies[entries.indexOf(e)].args,[x,y+h/2,z,w,h,d]);
    }
  }
  assert.equal(seats.length,1);
  assert.equal(seats[0].collider,proxies[0].handle);
  assert.ok(Math.abs(seats[0].y-.466)<.001);
  assert.ok(entries.every(e=>e.placed && e.placement.note));
});
