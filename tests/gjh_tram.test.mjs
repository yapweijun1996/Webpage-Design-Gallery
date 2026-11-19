import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {addTramDebug, sampleTramEnvelopes, roundedLoop, seatEyeHeight, tramRoute, tramStations} from '../demos/corporate/gjh/v11/assets/tram-layout.js';
import {buildPublicArchitecture} from '../demos/corporate/gjh/v11/assets/public-architecture.js';
import {addExpandedStorefronts} from '../demos/corporate/gjh/v11/assets/expanded-storefronts.js';
import {expandedLayout, shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {buildUpperLevel, deckPlanters} from '../demos/corporate/gjh/v11/assets/upper-level.js';
import {createSeatPlacements} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {NPC_ROUTES} from '../demos/corporate/gjh/v11/assets/npcs.js';
import {createShopSign} from '../demos/corporate/gjh/v11/assets/signage/builder.js';
import {resolveConfig, stores} from '../demos/corporate/gjh/v11/assets/signage/config.js';

const nominal = roundedLoop(expandedLayout.loop[0].x, expandedLayout.loop[0].z,
  expandedLayout.loop[2].x, expandedLayout.loop[2].z);
const noop = () => {};
function box(id, x, y, z, width, height, length, heading = 0) {
  return {id, x, z, bottom: y - height / 2, top: y + height / 2, width, length, heading};
}

// Separating-axis gap for two yawed boxes. Positive gives a lower bound
// on surface distance. Non-positive on all five axes means contact.
function gap(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const c = Math.abs(Math.cos(a.heading - b.heading)), s = Math.abs(Math.sin(a.heading - b.heading));
  function axes(rect, other) {
    const cos = Math.cos(rect.heading), sin = Math.sin(rect.heading);
    return Math.max(Math.abs(dx*cos - dz*sin) - (rect.width + c*other.width + s*other.length)/2,
      Math.abs(dx*sin + dz*cos) - (rect.length + s*other.width + c*other.length)/2);
  }
  return Math.max(a.bottom - b.top, b.bottom - a.top, axes(a,b), axes(b,a));
}

function obstacles(t) {
  const all = [];
  const add = (...args) => all.push(box(...args));
  const rect = (id,r,bottom,top) => add(id,(r.minX+r.maxX)/2,(bottom+top)/2,(r.minZ+r.maxZ)/2,
    r.maxX-r.minX,top-bottom,r.maxZ-r.minZ);
  const {garden, lounges, event} = atriumLayout;
  add('garden',garden.x,garden.height/2,garden.z,garden.width,garden.height,garden.depth);
  rect('event reserve',event,0,3);
  for (const lounge of lounges) {
    add('table',lounge.table.x,.28,lounge.table.z,.58,.56,.58);
    for (const p of lounge.planters) add('planter',p.x,.3,p.z,.7,.6,.7);
  }
  for (const seat of createSeatPlacements(true)) {
    add('seat',seat.x,seat.floor+.60,seat.z,seat.clearance.colliderWidth,1.2,seat.clearance.colliderDepth);
  }
  for (const [x,z] of deckPlanters) add('upper planter',x,liftLayout.upper+.25,z,.68,.5,.68);
  rect('lift shaft',liftLayout.shaft,0,liftLayout.upper);
  rect('upper slab',liftLayout.slab,liftLayout.upper-.25,liftLayout.upper);
  rect('restrooms',liftLayout.facilities,0,3);
  add('directory',liftLayout.directory.x,1.025,liftLayout.directory.z,.96,2.05,.68);
  add('desk',liftLayout.desk.x,.94,liftLayout.desk.z,2.88,1.88,.961);
  add('showcase',liftLayout.showcase.x,.9,liftLayout.showcase.z,.75,1.8,.532);
  add('kiosk',10,.5,20,1.8,1,1.4);
  for (const bay of expandedLayout.slots) {
    rect('shop '+bay.number,bay,0,5.5);
    const {x,z,normalX,normalZ,yaw} = shopEntrance(bay);
    const original = +bay.number <= 3, offset = original ? .05 : .025;
    // Full door opening plus both sliding pockets (union over all leaf poses).
    add('door S'+bay.number,x+normalX*offset,1.96,z+normalZ*offset,original ? 9.4 : 5.1,3.92,.16,yaw);
  }
  // Read the closed facade hardware (including projecting handles) from
  // the production instance transforms alongside the sliding pocket proxies.
  const storefronts=new T.Scene(), matrix=new T.Matrix4();
  const colors=new Map(expandedLayout.slots.map(bay=>['S'+bay.number,{palette:{accent:'#ffffff'}}]));
  addExpandedStorefronts(T,expandedLayout,storefronts,colors);
  for(const mesh of storefronts.children){
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);
      const bounds=new T.Box3(new T.Vector3(-.5,-.5,-.5),new T.Vector3(.5,.5,.5)).applyMatrix4(matrix);
      const centre=bounds.getCenter(new T.Vector3()), size=bounds.getSize(new T.Vector3());
      add(mesh.name,centre.x,centre.y,centre.z,size.x,size.y,size.z);
    }
  }
  // Capture public-architecture boxes, including visual pier plinths. Floor
  // finishes are intentional support surfaces under the debug track.
  t.mock.method(T.TextureLoader.prototype,'load',noop);
  t.mock.method(globalThis,'fetch',async () => new Response(null,{status:404}));
  globalThis.document = {createElement: () => ({getContext: () => null})};
  globalThis.window = {requestIdleCallback: noop};
  t.after(() => { delete globalThis.document; delete globalThis.window; });
  buildPublicArchitecture(T,{scene:new T.Scene(),garden,geometry:{box:new T.BoxGeometry(),plane:new T.PlaneGeometry()},
    materials:Object.fromEntries(['oak','ivory','courtStone'].map(k=>[k,new T.MeshStandardMaterial()])),
    solid:noop,lightPool:noop,box(material,x,y,z,w,h,d) {
      if (y+h/2 > .05) add('architecture '+x+','+z,x,y,z,w,h,d);
    }});
  buildUpperLevel(T,{map:null,models:{}},{lightWash:noop,collider:(...args)=>{add('upper structure',...args);}});
  const route = NPC_ROUTES.expanded;
  route.forEach(([x,z],i) => {
    const [ex,ez] = route[(i+1)%route.length];
    add('NPC '+i,(x+ex)/2,.9,(z+ez)/2,.70,1.8,Math.hypot(ex-x,ez-z)+.70,Math.atan2(ex-x,ez-z));
  });
  return all;
}

function survey(route, obstacles) {
  const hits = {car:new Set(),passenger:new Set(),camera:new Set()};
  const clear = {static:Infinity,door:Infinity, arch36:Infinity, arch42:Infinity, npc:Infinity};
  for (let d=0; d<route.length; d+=.25) {
    for (const envelope of sampleTramEnvelopes(route,d)) for (const obstacle of obstacles) {
      const g=gap(envelope,obstacle);
      if (g<=0) hits[envelope.id].add(obstacle.id);
      if (!obstacle.id.startsWith('NPC')) clear.static=Math.min(clear.static,g);
      const group = obstacle.id.startsWith('door') ? 'door' : obstacle.id.startsWith('NPC') ? 'npc'
        : /^architecture (1\.87|18\.13),36\.3$/.test(obstacle.id) ? 'arch36'
        : /^architecture (1\.87|18\.13),42\.05$/.test(obstacle.id) ? 'arch42' : null;
      if(group) clear[group]=Math.min(clear[group],g);
    }
  }
  return {hits:Object.fromEntries(Object.entries(hits).map(([k,v])=>[k,[...v].sort()])),clear};
}

function stationClearance(route, station, obstacles) {
  const d = nearest(route,station).distance;
  const envelope = sampleTramEnvelopes(route,d)[0];
  const clearance = shape => Math.min(...obstacles.map(obstacle=>gap(shape,obstacle)));
  const result = {car:clearance(envelope)};
  // 1.2 m square landing beside each car side, flush to its edge.
  for (const [side,offset] of [['left',1.3],['right',-1.3]]) {
    const x=envelope.x+offset*Math.cos(envelope.heading), z=envelope.z-offset*Math.sin(envelope.heading);
    const pad=box('landing',x,.9,z,1.2,1.8,1.2,envelope.heading);
    result[side]={gap:clearance(pad),hits:obstacles.filter(o=>gap(pad,o)<=0).map(o=>o.id)};
  }
  return result;
}
function nearest(route, target) {
  const error = d => {
    const p=route.sample(d);
    return Math.hypot(p.x-target.x,p.z-target.z);
  };
  let best=0;
  for (let d=.25; d<route.length; d+=.25) if(error(d)<error(best)) best=d;
  // Refine the closest sampled interval, including either side of the loop seam.
  let lo=best-.25, hi=best+.25;
  for(let i=0;i<45;i++){
    const a=(2*lo+hi)/3,b=(lo+2*hi)/3;
    if(error(a)<error(b)) hi=b; else lo=a;
  }
  const distance=((lo+hi)/2+route.length)%route.length;
  return {distance,...route.sample(distance)};
}
function sightlines(route) {
  const kit=JSON.parse(readFileSync(new URL('../demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json',import.meta.url)));
  return expandedLayout.slots.map(bay=>{
    const id='S'+bay.number, config=resolveConfig(id,stores[id],bay,kit,{});
    const sign=createShopSign(T,config,bay), mount=sign.userData.mount;
    const target=sign.localToWorld(new T.Vector3(0,mount.y,mount.z));
    const p=nearest(route,target), dx=p.x-target.x,dz=p.z-target.z;
    const {normalX,normalZ}=shopEntrance(bay), normal=dx*normalX+dz*normalZ;
    const skew=Math.atan2(Math.abs(dx*normalZ-dz*normalX),normal)*180/Math.PI;
    const angle=Math.acos(normal/Math.hypot(dx,dz,target.y-seatEyeHeight))*180/Math.PI;
    const turn=Math.atan2(-dx,-dz)-p.heading;
    const yaw=Math.atan2(Math.sin(turn),Math.cos(turn))*180/Math.PI;
    const pitch=Math.atan2(target.y-seatEyeHeight,Math.hypot(dx,dz))*180/Math.PI;
    return {id, yaw:+yaw.toFixed(1), pitch:+pitch.toFixed(1), d:p.distance.toFixed(2),x:p.x.toFixed(2),z:p.z.toFixed(2),skew:+skew.toFixed(1),angle:+angle.toFixed(1)};
  });
}

test('debug runtime mounts a closed line and animates the car from the station',()=>{
  const scene={objects:[],add(...objects){this.objects.push(...objects);}};
  let time=1000;
  const tick=addTramDebug(T,scene,()=>time);
  const [line,car]=scene.objects;
  assert.ok(line.isLineLoop && car.isMesh);
  assert.equal(car.geometry.parameters.width,1.4);
  assert.equal(car.geometry.parameters.depth,3);
  assert.equal(car.position.x,tramStations.entry.x);
  assert.equal(car.position.z,tramStations.entry.z);
  time+=2000;
  tick();
  assert.ok(Math.abs(car.position.x-7)<1e-8);
  assert.ok(Math.abs(car.rotation.y+Math.PI/2)<1e-8);
  for(let d=-.25;d<tramRoute.length;d+=.25){
    const a=tramRoute.sample(d), b=tramRoute.sample(d+.25), c=tramRoute.sample(d+tramRoute.length);
    const chord=Math.hypot(b.x-a.x,b.z-a.z);
    assert.ok(chord>.249 && chord<=.250001);
    assert.ok(Math.hypot(a.x-c.x,a.z-c.z)<1e-8);
  }
});
test('quarter-metre envelope sweep and nearest fascia views',t=>{
  const boxes=obstacles(t);
  const baseline=survey(nominal,boxes), adjusted=survey(tramRoute,boxes);
  const views=sightlines(tramRoute);
  const stations=Object.fromEntries(Object.entries(tramStations).map(([id,s])=>[id,stationClearance(tramRoute,s,boxes)]));
  t.diagnostic(JSON.stringify({baseline,adjusted,stations,views}));
  assert.ok(baseline.hits.car.includes('NPC 11'));
  assert.deepEqual(adjusted.hits,{car:[],passenger:[],camera:[]});
  for(const value of Object.values(adjusted.clear)) assert.ok(Number.isFinite(value)&&value>0);
  for(const value of Object.values(stations)) assert.ok(value.car>0);
  assert.ok(stations.entry.left.gap>0);
  assert.equal(views.length,17);
  assert.deepEqual(views.filter(view=>view.skew>45).map(view=>view.id),['S11','S17']);
});

test('expanded world startup only mounts tram objects for tram=debug',async t=>{
  const {createWorld}=await import('../demos/corporate/gjh/v11/assets/world.js');
  t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:404}));
  t.mock.method(T.TextureLoader.prototype,'loadAsync',async()=>new T.Texture({width:1,height:1}));
  const boundary=new Error('Reached public architecture after the tram hook');
  let scene;
  const three={...T,Scene:class extends T.Scene { constructor(){super(); scene=this;} },
    Shape:class {constructor(){throw boundary;}}};
  const rapier={ColliderDesc:{cuboid:()=>({setTranslation:noop})}};
  const context={fillRect:noop,createRadialGradient:()=>({addColorStop:noop})};
  globalThis.document={addEventListener:noop,createElement:()=>({getContext:()=>context})};
  t.after(()=>{delete globalThis.location; delete globalThis.document;});
  for(const [query,expected] of [['',false],['&tram=off',false],['&tram=debug',true]]){
    globalThis.location=new URL('https://example.invalid/mall/?visitor=v1'+query);
    await assert.rejects(createWorld(three,rapier,{createCollider:noop},true),error=>error===boundary);
    assert.equal(Boolean(scene.getObjectByName('Tram debug car')),expected);
    assert.equal(Boolean(scene.getObjectByName('Tram debug route')),expected);
  }
});
