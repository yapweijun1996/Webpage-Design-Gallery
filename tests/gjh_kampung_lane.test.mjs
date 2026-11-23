import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createDistrictGateway} from '../demos/corporate/gjh/v11/assets/district-gateway.js';
import {loadKampungLane} from '../demos/corporate/gjh/v11/assets/kampung-lane.js';
import {limitCameraByObstacles} from '../demos/corporate/gjh/v11/assets/camera-controller.js';

const assets=new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
await R.init(readFileSync(new URL('../vendor/rapier_bg.wasm',assets)));
const base=new URL('districts/malaysia/',assets);
const read=async url=>new Response(readFileSync(url));

test('the staged Malaysian street supports the full public loop and releases only its own resources',async()=>{
  const scene=new T.Scene(), physics=new R.World({x:0,y:-24,z:0}), bounds=[new T.Box3()];
  const visits=[];
  const loadLane=(T,signal)=>loadKampungLane(T,signal,{base,read:async url=>{
    visits.push(url.pathname);return read(url);
  }});
  const detail=[];
  const gateway=createDistrictGateway({T,R,physics,scene,cameraObstacles:bounds,setMallDetail:value=>detail.push(value),notice:()=>{},loadLane});
  const original=physics.colliders.len();
  assert.equal(await gateway.visitLane(arrival=>{
    assert.equal(arrival.x,325.8);
    physics.step();
    for(const x of [314.2,325.8]) for(const z of [62,67,77,87,96]) {
      const hit=physics.castRay(new R.Ray({x,y:1,z},{x:0,y:-1,z:0}),2,true);
      assert.ok(hit && Math.abs(hit.timeOfImpact-1.02)<.05,'continuous verge');
    }
    const ray=new R.Ray({x:325.8,y:.9,z:64},{x:0,y:0,z:1});
    assert.equal(physics.castRay(ray,30,true),null);
    for(const [x,z] of [[325.8,67],[314.2,72],[325.8,83],[314.2,88]]) {
      const origin=new T.Vector3(x,1.8,z);
      for(const yaw of [0,Math.PI/2,Math.PI,1.5*Math.PI]) {
        const distance=limitCameraByObstacles(origin,new T.Vector3(Math.sin(yaw),.1,Math.cos(yaw)).normalize(),5,.22,bounds.slice(1));
        assert.ok(distance>1.4,'walking view '+x+','+z+' '+yaw);
      }
    }
    return true;
  }),true);
  assert.equal(visits.filter(p=>p.endsWith('.glb')).length,3);
  assert.equal(gateway.inKampung,true);
  assert.equal(gateway.state.street.models,0);
  assert.deepEqual(detail,[false]);
  const costs=gateway.state.kampung;
  assert.equal(costs.models,3);assert.ok(costs.geometries<=24 && costs.colliders>15 && costs.cameraBounds>10);
  assert.equal(gateway.leaveLane(()=>false),false);assert.equal(gateway.inKampung,true);
  assert.equal(gateway.leaveLane(()=>true),true);assert.deepEqual(detail,[false,true]);
  assert.equal(bounds.length,1);assert.equal(physics.colliders.len(),original);
  assert.equal(scene.children.some(node=>node.name.includes('Kampung')),false);
  gateway.dispose();physics.free();
});

test('failure, late canceled load, and denied arrival keep the origin owner',async()=>{
  const scene=new T.Scene(),physics=new R.World({x:0,y:-24,z:0});
  let resolve, calls=0,disposals=0,mounts=0,moves=0;
  const prepared={mount(){mounts++;},dispose(){disposals++;},arrival:{}};
  const gateway=createDistrictGateway({T,R,physics,scene,cameraObstacles:[],setMallDetail:()=>assert.fail(),notice:()=>{},
    loadLane:async()=>{if(++calls===1)throw new Error('offline');if(calls===2)return await new Promise(r=>resolve=r);return prepared;}});
  assert.equal(await gateway.visitLane(()=>{moves++;}),false);
  const pending=gateway.visitLane(()=>{moves++;});gateway.cancelVisit();resolve(prepared);
  assert.equal(await pending,false);assert.equal(mounts,0);assert.equal(moves,0);
  assert.equal(await gateway.visitLane(()=>false),false);assert.equal(mounts,1);assert.equal(disposals,2);
  assert.equal(gateway.inKampung,false);gateway.dispose();physics.free();
});

test('unverifiable or modified residential models never mount',async t=>{
  const corrupt=async url=>{
    const bytes=readFileSync(url);
    if(url.pathname.endsWith('terrace-house.glb')) bytes[bytes.length-1]^=1;
    return new Response(bytes);
  };
  const signal=new AbortController().signal;
  await assert.rejects(loadKampungLane(T,signal,{base,read:corrupt}),/changed/);
  const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});
  t.after(()=>Object.defineProperty(globalThis,'crypto',original));
  await assert.rejects(loadKampungLane(T,signal,{base,read:()=>assert.fail('unexpected fetch')}),/verification unavailable/);
});
