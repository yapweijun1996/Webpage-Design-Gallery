import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createElevatorV2} from '../demos/corporate/gjh/v11/assets/elevator-v2.js';
import {elevatorRideBlockReason, floorDestinations} from '../demos/corporate/gjh/v11/assets/elevator-ride.js';
import {liftLayout as L} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {createPlayer} from '../demos/corporate/gjh/v11/assets/player.js';

test('map floor options request the correct stops', () => {
  assert.deepEqual(Object.entries(floorDestinations), [
    ['floor-upper', {label:'Upper level', upper:true}],
    ['floor-ground', {label:'Ground floor', upper:false}],
  ]);
});

test('ride rules explain cart, held product, active ride and bench restrictions', () => {
  assert.match(elevatorRideBlockReason({pushing:true}), /Stow your cart/);
  for (const phase of ['picking', 'held', 'returning', 'adding']) {
    assert.match(elevatorRideBlockReason({physicalProduct:{phase}}), /Return the held product/);
  }
  assert.match(elevatorRideBlockReason({productApproaching:true}), /Return the held product/);
  assert.match(elevatorRideBlockReason({elevatorTravel:true}), /Wait for the elevator/);
  assert.match(elevatorRideBlockReason({seated:true}), /Stand up/);
  assert.equal(elevatorRideBlockReason({physicalProduct:{phase:'empty'}}), '');
});

test('no-browser smoke: real player calls and rides the physical cabin in both directions', async t => {
  t.mock.method(globalThis, 'fetch', async request => {
    const file = new URL(request.url ?? request);
    const type = file.pathname.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    return new Response(await readFile(file), {headers:{'Content-Type':type}});
  });
  const noop = () => {};
  const canvas = {clientWidth:390, clientHeight:844, dataset:{}, style:{},
    classList:{add:noop, remove:noop, toggle:noop}, addEventListener:noop, setAttribute:noop};
  canvas.querySelector = () => canvas;
  Object.assign(globalThis, {
    location:{search:'?visitor=v1'}, window:{performance, matchMedia:() => ({matches:false}), addEventListener:noop},
    document:canvas, matchMedia:() => ({matches:false}),
    ProgressEvent:class { constructor(type, init) { Object.assign(this, {type}, init); } },
  });
  t.after(() => {
    for (const key of ['location','window','document','matchMedia','ProgressEvent']) delete globalThis[key];
  });
  await R.init();
  const physics = new R.World({x:0,y:-24,z:0});
  t.after(() => physics.free());
  physics.createCollider(R.ColliderDesc.cuboid(16,.1,16).setTranslation(0,-.1,10));
  physics.timestep = 1/60;
  const scene = new T.Scene();
  const elevator = createElevatorV2(T,R,physics,scene,true);
  const player = await createPlayer(T,R,physics,scene,canvas,new T.MeshBasicMaterial(),new T.PlaneGeometry(),[],[],true);
  const step = () => {
    elevator.update(1/60,player.state);
    player.update(1/60);
    physics.step();
  };
  const height = () => player.state.y;
  const closeTo = floor => assert(Math.abs(height()-floor)<.08, `Expected floor ${floor}, got ${height()}`);
  physics.step();
  step();
  assert.match(player.useElevator(elevator).reason,/Walk to the visitor lift/);
  assert(player.teleport('atrium'));
  physics.step();
  assert(player.setCart(true));
  const before = player.body.translation();
  assert.match(player.useElevator(elevator, undefined, {approach:true,target:L.upper}).reason,/Stow your cart/);
  assert.deepEqual(player.body.translation(),before);
  assert(player.setCart(false));
  elevator.setHeight(L.upper);
  physics.step();
  assert.deepEqual(player.useElevator(elevator, undefined, {approach:true,target:L.upper}), {calling:true});
  closeTo(0);
  for (let i=0; i<160; i++) step();
  assert.equal(elevator.state.docked,0);
  closeTo(0);
  assert.deepEqual(player.useElevator(elevator, undefined, {target:L.upper}), {riding:true});
  for (let i=0; i<55; i++) step();
  assert(height()>0 && height()<L.upper && player.state.elevatorTravel);
  for (let i=0; i<65; i++) step();
  closeTo(L.upper);
  assert.equal(elevator.state.docked,L.upper);
  assert.equal(player.state.capsuleEnabled,true);
  assert.deepEqual(player.useElevator(elevator, undefined, {approach:true,target:0}), {riding:true});
  for (let i=0; i<120; i++) step();
  closeTo(0);
  assert.equal(elevator.state.docked,0);
  assert.equal(player.state.capsuleEnabled,true);
});
