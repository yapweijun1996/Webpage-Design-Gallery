import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {buildUpperLevel,loadUpperLevel,deckPlanters} from '../demos/corporate/gjh/v11/assets/upper-level.js';
import {createElevatorV2} from '../demos/corporate/gjh/v11/assets/elevator-v2.js';
import {limitCameraByObstacles} from '../demos/corporate/gjh/v11/assets/camera-controller.js';
import {liftLayout as L,upperLiftCameraBounds,shaftFinish} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {createMallSurfaceAtmosphere} from '../demos/corporate/gjh/v11/assets/mall-atmosphere.js';
import {cells,categories} from '../demos/corporate/gjh/v11/assets/upper-level-atlas.js';
import {createSeatAnchor,createSeatPlacements} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {addBrandWallAtlas} from '../demos/corporate/gjh/v11/assets/brand-wall.js';
import {clearanceGrid,distance} from '../scripts/gjh_interiors/sweep.mjs';

import {brandRail,directory,lounge,upperSeats} from '../demos/corporate/gjh/v11/assets/upper-layout.js';

const route = JSON.parse(await readFile(new URL('../docs/gjh-v11-upper-level-route.json', import.meta.url)));

function localFetch(t) {
  t.mock.method(globalThis,'fetch',async url=>{
    const file=new URL(url);
    return new Response(await readFile(file),{headers:{'Content-Type':file.pathname.endsWith('.wasm')?'application/wasm':'application/octet-stream'}});
  });
}

test('actual upper batches, gallery GLBs and tier washes fit the phone budget',async t=>{
  localFetch(t);
  const labels=[];
  const noop=()=>{};
  const ctx=new Proxy({fillText:(...args)=>labels.push(args),createLinearGradient:()=>({addColorStop:noop})},
    {get:(target,key)=>target[key]??noop});
  globalThis.Image=class {decode(){return Promise.resolve();}};
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{delete globalThis.Image;delete globalThis.document;});
  const assets=await loadUpperLevel(T);
  assert(Object.values(assets.models).every(asset=>asset.status==='loaded'));
  const scene=new T.Scene(),washes=[];
  const build=buildUpperLevel(T,assets,{collider:noop,lightWash:(...a)=>washes.push(a)});
  scene.add(build.group,build.panes,build.cabinMark);
  const glass = build.panes.getObjectByName('Daylight glass');
  assert.equal(glass.material.side,T.FrontSide);
  const fromBelow = new T.Raycaster(new T.Vector3(-3,13,10),new T.Vector3(0,1,0));
  const fromAbove = new T.Raycaster(new T.Vector3(-3,20,10),new T.Vector3(0,-1,0),0,6);
  assert.ok(fromBelow.intersectObject(glass).length,'roof is visible from inside');
  assert.equal(fromAbove.intersectObject(glass).length,0,'roof has no outer face');

  const lounge=build.group.getObjectByName('Lounge, stone paving and shop arcade');
  for(const placement of createSeatPlacements(true).filter(({group})=>group==='deck')){
    const profile=build.seatProfiles.get(placement.finish);
    if(placement.finish==='upholstered'){
      assert.equal(profile,undefined);
      continue;
    }
    const seat=createSeatAnchor(placement,1,profile,1);
    const ray=new T.Raycaster(new T.Vector3(seat.x,seat.y+.2,seat.z),new T.Vector3(0,-1,0),0,.3);
    const [hit]=ray.intersectObject(lounge);
    assert.ok(hit,`${seat.name} has a seat surface`);
    assert.ok(Math.abs(hit.point.y-seat.y)<.001,`${seat.name} anchor matches the rendered seat`);
  }
  const atmosphere=createMallSurfaceAtmosphere(T,scene,{plane:new T.PlaneGeometry(),poolMaterial:new T.MeshBasicMaterial(),
    washes,floors:[],fixtures:new T.MeshStandardMaterial(),vault:new T.MeshStandardMaterial()});
  for(const tier of ['low','balanced','detailed','low']){
    atmosphere.setTier(tier);
    let draws=0,triangles=0;
    scene.traverseVisible(node=>{
      assert(!node.isLight && !node.castShadow);
      if(!node.isMesh)return;
      const mat=node.material,passes=mat.transparent&&mat.side===T.DoubleSide&&!mat.forceSinglePass?2:1;
      assert(!Array.isArray(mat) && !node.layers.isEnabled(1));
      const g=node.geometry;triangles+=passes*(node.count??1)*(g.index?.count??g.attributes.position.count)/3;draws+=passes;
      if(mat.map)assert(mat.map.image.width<=256&&mat.map.image.height<=256);
    });
    t.diagnostic(tier+' '+draws+' draws, '+triangles+' triangles (including the shared wash batch when visible)');
    // Pre-finish Low batch was 6 draws / 5,633 triangles. Higher tiers
    // also draw the shared light wash.
    assert(draws <= (tier==='low' ? 6+1 : 7+2));
    if(tier==='low')assert(triangles<=Math.min(6000,5633+600));
  }
  assert.deepEqual(labels.filter(([,x])=>x===9).map(([label])=>label),['DIRECTORY','Upper Level',...categories]);
  for(const rect of [cells.mark,cells.directory,...cells.signs])assert(rect.x+rect.w<=256&&rect.y+rect.h<=256);
});

function mockBrandCanvas(t) {
  const noop=()=>{};
  const ctx=new Proxy({measureText:value=>({width:value.length*8})},{get:(target,key)=>target[key]??noop});
  globalThis.Image=class {set src(_url){queueMicrotask(()=>this.onerror());}};
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{delete globalThis.Image;delete globalThis.document;});
}

test('the brand wall warms before its mesh and story interactions are available',async t=>{
  localFetch(t);
  mockBrandCanvas(t);
  const scene=new T.Scene();
  let revealMesh,finishUpload;
  const started=new Promise(resolve=>{revealMesh=resolve;});
  const upload=new Promise(resolve=>{finishUpload=resolve;});
  const pending=addBrandWallAtlas(T,scene,L.upper,(mesh,options)=>{
    revealMesh({mesh,priority:options?.priority});
    return upload;
  });
  const {mesh,priority}=await started;
  assert.equal(priority?.(),-90);
  assert.equal(mesh.parent,null);
  assert.equal(mesh.material.map.image.width,256);
  finishUpload();
  const wall=await pending;
  assert.equal(wall.mesh,mesh);
  assert.equal(mesh.parent,scene);
  assert.equal(mesh.visible,false);
  assert.equal(mesh.userData.deckLod,true);
  assert.equal(wall.interactables.length,17);
  const positions=mesh.geometry.attributes.position;
  for(const [i,point] of wall.interactables.entries()){
    const v=i*4, x=(positions.getX(v)+positions.getX(v+1))/2;
    assert(Math.abs(x-point.x)<1e-5);
    assert.equal(point.z,brandRail.z-1.02);
    for(let k=0;k<4;k++){
      assert.equal(positions.getZ(v+k),positions.getZ(0),'parallel to south rail');
      assert.equal(positions.getY(v+k),positions.getY(k),'single sign height');
    }
    if(i)assert(Math.abs(positions.getX(v)-positions.getX(v-4)+brandRail.pitch)<1e-5);
  }
  assert.ok(wall.interactables.every(({id,y})=>wall.records[id]?.action==='brand-story' && y===L.upper));
});

test('walking capsule stops at outer edges, shaft sides, corners and the undocked gate',async t=>{
  localFetch(t);await R.init();
  const physics=new R.World({x:0,y:-24,z:0});
  t.after(()=>physics.free());
  const scene=new T.Scene(),elevator=createElevatorV2(T,R,physics,scene,true);
  const colliders=(x,y,z,w,h,d)=>physics.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z));
  const upper=buildUpperLevel(T,{map:null,models:{}},{collider:colliders,lightWash:()=>{}});
  // The procedural lamp has the same 0.60 m footprint as the loaded model.
  const lampBaseAt=dx=>new T.Raycaster(
    new T.Vector3(lounge.lamp[0]+dx,L.upper+.11,lounge.lamp[1]),new T.Vector3(0,-1,0),0,.08
  ).intersectObject(upper.group.getObjectByName('Lounge, stone paving and shop arcade'));
  assert(lampBaseAt(.27).length>0);
  assert.equal(lampBaseAt(.32).length,0);
  scene.add(upper.group,upper.panes);
  scene.getObjectByName('Expanded physical lift cabin').add(upper.cabinMark);
  const directoryRay=new T.Raycaster(new T.Vector3(L.exit.x,L.upper+1.16,L.exit.z),new T.Vector3(-1,0,0));
  const [sign]=directoryRay.intersectObject(upper.group,true);
  assert.equal(sign.object.name,'Directory, mall mark and display graphics');
  assert(sign.distance>=1.5 && sign.face.normal.x>.999);
  assert(Math.abs(sign.uv.x-(cells.directory.x+cells.directory.w/2)/256)<.01);
  assert(Math.abs(sign.uv.y-(1-(cells.directory.y+cells.directory.h/2)/256))<.01);
  const view=new T.Raycaster(new T.Vector3(-5.2,L.upper+1.26,L.z),new T.Vector3(1,0,0));
  for(const height of [0,L.upper]){
    elevator.setHeight(height);physics.step();scene.updateMatrixWorld(true);
    const below=physics.castRay(new R.Ray({x:L.x,y:L.upper+.2,z:L.z},{x:0,y:-1,z:0}),10,true);
    assert(below);
    if(height===0)assert(below.timeOfImpact>L.upper,'open shaft exposes lower landing');
    else assert(below.timeOfImpact<.21,'the docked cabin provides a floor');
    const hit=view.intersectObjects(scene.children,true)[0];
    assert.equal(hit.object.name,height===0?'Directory, mall mark and display graphics':'GJH cabin face');
    const {x,y,w,h}=cells.mark;
    assert(hit.uv.x>x/256&&hit.uv.x<(x+w)/256&&hit.uv.y>1-(y+h)/256&&hit.uv.y<1-y/256);
  }
  const body=physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
  const capsule=physics.createCollider(R.ColliderDesc.capsule(.55,.3),body);
  const ctrl=physics.createCharacterController(.025);ctrl.enableAutostep(.2,.28,true);ctrl.enableSnapToGround(.25);
  function advance(dx,dz,steps){
    for(let i=0;i<steps;i++){
      ctrl.computeColliderMovement(capsule,{x:dx*.055,y:-.018,z:dz*.055});
      const at=body.translation(),m=ctrl.computedMovement();
      body.setNextKinematicTranslation({x:at.x+m.x,y:at.y+m.y,z:at.z+m.z});physics.step();
      assert(body.translation().y>L.upper+.80,'walk left the supported upper floor');
    }
    return body.translation();
  }
  function walk(x,z,dx,dz,steps=65,floor=L.upper){
    body.setTranslation({x,y:floor+.875,z},true);physics.step();
    return advance(dx,dz,steps);
  }
  for(const [x,z,dx,dz] of [[-7,6,-1,0],[1,10,1,0],[-4,6,0,-1],[0,14.2,0,1],
    [-7.6,5.4,-1,-1],[1.5,5.5,1,-1],[1.6,14.6,1,1],[-7.6,14.6,-1,1]]){
    const p=walk(x,z,dx,dz);
    assert(p.x>=L.slab.minX+.29&&p.x<=L.slab.maxX-.29&&p.z>=L.slab.minZ+.29&&p.z<=L.slab.maxZ-.29);
  }
  const approaches=[[-6.4,10,1,0],[-6.4,8.55,1,0],[-6.4,11.45,1,0],[.5,10,-1,0],[-3,6.45,0,1],[-3.8,13.05,0,-1],
    [-6.3,6.7,1,1],[.3,6.7,-1,1],[.3,13.3,-1,-1],[-6.3,13.3,1,-1]];
  for(const height of [0,L.upper/2,L.upper]){
    elevator.setHeight(height);
    for(const [i,[x,z,dx,dz]] of approaches.entries()){
      const p=walk(x,z,dx,dz);
      if(i===0&&height===L.upper){assert(p.x>L.threshold.maxX+.30,'docked passage admits a walking capsule');continue;}
      const gapX=Math.max(L.shaft.minX-p.x,0,p.x-L.shaft.maxX);
      const gapZ=Math.max(L.shaft.minZ-p.z,0,p.z-L.shaft.maxZ);
      assert(Math.hypot(gapX,gapZ)>=.30,JSON.stringify({height,i,x,z,p}));
      assert(Math.hypot(p.x-x,p.z-z)>.24,JSON.stringify({message:'approach should reach the rail',height,i,x,z,p}));
    }
  }
  const cx=(L.slab.maxX+L.roofOpening.maxX)/2,cz=L.z;
  colliders(cx,-.1,cz,40,.2,40);
  for(const cabinHeight of [0,L.upper]){
    elevator.setHeight(cabinHeight);physics.step();
    const open=physics.castRay(new R.Ray({x:cx,y:L.upper+2,z:cz},{x:0,y:-1,z:0}),16,true);
    assert(Math.abs(open.timeOfImpact-L.upper-2)<.01,'permanent atrium is open to the ground floor at both stops');
    assert(walk(L.slab.maxX-1,cz,1,0).x<L.slab.maxX-.29);
    for (const x of [4, 6, 8]) for (const z of [3.48, 16.52, cz]) {
      const hit = physics.castRay(new R.Ray({x,y:L.upper+2,z},{x:0,y:-1,z:0}),16,true);
      assert(Math.abs(hit.timeOfImpact-L.upper-2)<.01, 'former bridge and apron are clear of false floors');
    }
  }
  const aisle=walk(-4.75,12.56,1,0,100);
  assert(aisle.x>.45,'walk between the directory and south shaft guard');
  for(const dz of [-1,1]){
    const p=walk(-4.78,10,0,dz);
    assert(Math.abs(p.z-10)<.72,'docked threshold side returns prevent a lateral fall');
  }

  // Include the furnishing colliders owned by world.js in the real lift and
  // upper-level scene. Walk from the landing continuously through each side.
  colliders(brandRail.x,L.upper+brandRail.y,brandRail.z,brandRail.width,brandRail.height,brandRail.depth);
  for(const [x,z] of deckPlanters)colliders(x,L.upper+.25,z,.68,.5,.68);
  const deckSeats=createSeatPlacements(true).filter(({group})=>group==='deck');
  const seatColliders=deckSeats.map(({x,z,clearance})=>
    colliders(x,L.upper+.26,z,clearance.colliderWidth,.5,clearance.colliderDepth));
  const aim=(axis,target,label)=>{
    const other=axis==='x'?'z':'x', cross=body.translation()[other];
    let p=body.translation();
    const direction=Math.sign(target-p[axis]);
    for(let i=0;i<250 && (target-p[axis])*direction>.06;i++){
      p=advance(axis==='x'?direction:0,axis==='z'?direction:0,1);
      assert(Math.abs(p[other]-cross)<.15,`${label}: left the perimeter lane`);
    }
    assert(Math.abs(p[axis]-target)<.10,`${label}: ${JSON.stringify(p)}`);
  };
  body.setTranslation({x:L.exit.x,y:L.upper+.875,z:L.exit.z},true);physics.step();
  for(const [axis,target,label] of [
    ['x',-8.18,'west exit'],['z',7.4,'west to north'],['x',1.32,'north to east'],
    ['z',14.67,'east to south'],['x',-8.18,'south to west'],['z',L.exit.z,'west return'],
    ['x',L.exit.x,'lift approach'],['x',L.x,'docked cabin']
  ])aim(axis,target,label);

  const walkingShape=new R.Capsule(.55,.3), rotation={x:0,y:0,z:0,w:1};
  for(const [i,placement] of deckSeats.entries()){
    const seat=createSeatAnchor(placement,seatColliders[i].handle,upper.seatProfiles.get(placement.finish),1);
    // Follow the open side from the perimeter to the exact interaction point.
    const laneX=placement.finish==='upholstered'?-4.12:.72;
    body.setTranslation({x:laneX,y:L.upper+.875,z:seat.exitZ},true);physics.step();
    aim('x',seat.exitX,seat.name+' approach');
    for(let j=0;j<=16;j++){
      const at={x:seat.exitX+(seat.x-seat.exitX)*j/16,y:L.upper+.9,z:seat.exitZ+(seat.z-seat.exitZ)*j/16};
      const obstruction=physics.intersectionWithShape(at,rotation,walkingShape,undefined,undefined,capsule,body,
        c=>c.handle!==seat.collider);
      assert.equal(obstruction,null,`${seat.name}: clear seated pose and stand path`);
    }
  }

  // Reuse the shop audit grid with the actual Rapier footprints and the
  // visitor's .30 m radius plus .025 m controller offset.
  const {minX,maxX,minZ,maxZ} = L.slab;
  const obstacles = [];
  physics.forEachCollider(c => {
    const {x,y,z} = c.translation();
    if (c.handle === capsule.handle || y <= L.upper || y > L.upper+1.75 || c.shapeType() !== R.ShapeType.Cuboid) return;
    const e = c.halfExtents();
    obstacles.push({xyz:[x,y,z],size:[2*e.x,2*e.y,2*e.z]});
  });
  const grid = clearanceGrid(([x,z]) => Math.min(x-minX,maxX-x,z-minZ,maxZ-z,
    ...obstacles.map(box => distance([x,z],box))), [L.exit.x,L.exit.z]);
  const radius = .325;
  const reachable = grid.flood(radius);
  assert(reachable.size > 5000, 'connected upper walkable area');
  mockBrandCanvas(t);
  const {interactables:plaques} = await addBrandWallAtlas(T,new T.Scene(),L.upper);
  assert.equal(plaques.length,17);
  const stops = route.flatMap(({id, at})=>{
    if (at) return [[id, at]];
    if (id === 'brand-wall') return plaques.map(p => [p.id,[p.x,p.z]]);
    const placement = deckSeats.find(seat => seat.name === id);
    assert(placement,id);
    return [[id,[placement.exit.x,placement.exit.z]]];
  });
  for (const [id, point] of stops) {
    const node = reachable.get(grid.key(point));
    assert(node && grid.edge(node,point,radius), `${id}: no capsule path to ${point}`);
  }

  // Exercise the continuous browser itinerary with the same Rapier controller.
  body.setTranslation({x:L.exit.x,y:L.upper+.875,z:L.exit.z},true); physics.step();
  for (const [id,[x,z]] of stops) {
    let p = body.translation(), remaining = Math.hypot(x-p.x,z-p.z);
    for (let i=0; i<450 && remaining>.038; i++) {
      p = advance((x-p.x)/remaining,(z-p.z)/remaining,1);
      remaining = Math.hypot(x-p.x,z-p.z);
    }
    assert(remaining<=.038,`${id}: blocked near (${p.x}, ${p.z}) en route to (${x}, ${z})`);
  }
});

test('upper plan leaves the arrival circle, furniture spacing and circulation lanes clear',()=>{
  const {x,z,yaw}=directory, dx=L.exit.x-x, dz=L.exit.z-z;
  const range=Math.hypot(dx,dz);
  assert(range-.085>=1.5);
  assert(Math.abs((Math.sin(yaw)*dx+Math.cos(yaw)*dz)/range-1)<1e-6);
  const items=[
    [x,z,.17,directory.width+.10],
    ...upperSeats.map(s=>[s.x,s.z,...(s.finish==='upholstered'?[2.34,.785]:[.76,2.13])]),
    ...deckPlanters.map(([px,pz])=>[px,pz,.90,.90]),
    [...lounge.table,.86,.56],[...lounge.lamp,.6,.6],
    ...lounge.ottomans.map(p=>[...p,.66,.66])
  ];
  const separation=([ax,az,aw,ad],[bx,bz,bw,bd])=>Math.hypot(
    Math.max(0,Math.abs(ax-bx)-(aw+bw)/2),Math.max(0,Math.abs(az-bz)-(ad+bd)/2));
  for(const [i,item] of items.entries()){
    assert(separation(item,[L.exit.x,L.exit.z,0,0])>=.75);
    for(const other of items.slice(i+1))assert(separation(item,other)>=.9,JSON.stringify([item,other]));
    // Protected 1.2 m wide circulation strips with overlapping corner landings.
    for(const lane of [[-7.65,11.1,1.2,8.3],[-3.275,7.34,9.95,1.2],
      [1.10,10.8,1.2,8.1],[-3.275,14.45,9.95,1.2]]){
      assert(separation(item,lane)>0,JSON.stringify([item,lane]));
    }
  }
  assert(7.34+.6<L.shaft.minZ-.05 && 1.10-.6>L.shaft.maxX+.17);
});

test('shaft elevations and roof share green lacquer and leave the door clear',()=>{
  const {group}=buildUpperLevel(T,{map:null,models:{}},{collider:()=>{},lightWash:()=>{}});
  const panels=group.getObjectByName('Upper lift shaft lacquer panels');
  assert.equal(panels.material.name,'Deep green shaft lacquer');
  const {r,g,b}=panels.material.color;
  assert(Math.min(r,g,b)>=.06 && g>r && g>b);
  const cast=(origin,direction)=>new T.Raycaster(new T.Vector3(...origin),
    new T.Vector3(...direction),0,3).intersectObject(panels);
  const y=L.upper+1.5;
  for(const [origin,direction] of [
    [[-7,y,8.55],[1,0,0]],[[1,y,10],[-1,0,0]],
    [[-3,y,6],[0,0,1]],[[-3,y,14],[0,0,-1]],
    [[-7,L.upper+3.4,10],[1,0,0]],[[-3,L.upper+5,10],[0,-1,0]]
  ])assert(cast(origin,direction).length>0);
  assert.equal(cast([-7,y,10],[1,0,0]).length,0);
});

test('phone chase sweep stays inside the docked cabin and outside the finished walkway face',()=>{
  const sweep=(x,z,dx,dy,dz)=>limitCameraByObstacles({x,y:L.upper+1.6,z},
    {x:dx,y:dy,z:dz},5,.22,upperLiftCameraBounds({x,z}));
  assert(sweep(-1.8,11.2,0,0,1)<.28);
  assert(sweep(-1.8,11.2,0,1,0)<1.04);
  const outside=1.0;
  assert(outside-sweep(outside,10,-1,0,0)>=shaftFinish.east+.22);
  assert(sweep(L.x,L.z,-1,0,0)>3,'open doorway');
});
