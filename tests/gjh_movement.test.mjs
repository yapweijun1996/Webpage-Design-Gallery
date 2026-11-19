import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createDoorwayOccupancy} from '../demos/corporate/gjh/v11/assets/doorway-occupancy.js';
import {sweepCameraClearance} from '../demos/corporate/gjh/v11/assets/camera-controller.js';
import {advanceVelocity, createFixedClock, FIXED_STEP, interpolate, interpolateAngle, MOVEMENT,
  stickStrength} from '../demos/corporate/gjh/v11/assets/movement.js';

const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);

test('walking, sprinting and cart pacing use the configured speed and ramp rates', () => {
  const {desktopWalk, desktopRun, touchWalk, touchRun, cart, turnRate, stepHeight} = MOVEMENT;
  assert.deepEqual([desktopWalk, desktopRun, touchWalk, touchRun, cart, stepHeight], [3.4, 5.2, 3.1, 4.5, 1.8, .18]);
  near(turnRate * 180 / Math.PI, 140);
  const velocity = {x:0,z:0};
  advanceVelocity(velocity, 1, 0, 0, desktopWalk, FIXED_STEP);
  near(velocity.z, -10 * FIXED_STEP);
  for (let i = 0; i < 60; i++) advanceVelocity(velocity, 1, 1, 0, desktopRun, FIXED_STEP);
  near(Math.hypot(velocity.x, velocity.z), desktopRun);
  advanceVelocity(velocity, 0, 0, 0, desktopRun, FIXED_STEP);
  near(Math.hypot(velocity.x, velocity.z), desktopRun - 18 * FIXED_STEP);
  for (let i = 0; i < 60; i++) advanceVelocity(velocity, 0, 0, 0, desktopRun, FIXED_STEP);
  near(Math.hypot(velocity.x, velocity.z), 0);
  for (const radius of [38, 50, 56]) {
    near(stickStrength(radius * .12, radius), 0);
    near(stickStrength(radius * .56, radius), .5);
    near(stickStrength(radius, radius), 1);
  }
});

test('the same fixed-tick replay advances one physics step per tick at 30, 60 and 120 Hz', () => {
  function replay(hz) {
    const clock = createFixedClock(), velocity = {x:0,z:0};
    let tick = 0, steps = 0, now = 0;
    let x = 0, z = 0, previous = 0, rendered = 0;
    for (let frame = 1; frame <= hz * 3; frame++) {
      const next = frame / hz;
      steps += clock.advance(next - now, () => {
        previous = x;
        const right = tick < 60 ? 1 : tick < 90 ? 0 : -1;
        const speed = tick < 120 ? MOVEMENT.desktopWalk : MOVEMENT.desktopRun;
        const yaw = Math.max(0, tick - 120) * FIXED_STEP * MOVEMENT.turnRate;
        advanceVelocity(velocity, 0, right, yaw, speed, FIXED_STEP);
        x += velocity.x * FIXED_STEP;
        z += velocity.z * FIXED_STEP;
        tick++;
      });
      now = next;
      rendered = interpolate(previous, x, clock.alpha);
      assert.ok(rendered >= Math.min(previous,x) && rendered <= Math.max(previous,x));
    }
    assert.equal(steps, 180);
    assert.equal(tick, steps);
    return {x, z, rendered};
  }
  const baseline = replay(60);
  for (const hz of [30, 120]) {
    const other = replay(hz);
    near(Math.hypot(other.x - baseline.x, other.z - baseline.z), 0, .01);
    near(other.rendered, baseline.rendered, .01);
  }
  near(interpolateAngle(Math.PI - .1, -Math.PI + .1, .5), Math.PI);
});

const identity = {x:0,y:0,z:0,w:1};

test('Rapier cart clears a 2.48 m entrance in both directions and holds the door while crossing', async t => {
  const original = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    return url.protocol === 'file:'
      ? new Response(await readFile(url), {headers:{'Content-Type':'application/wasm'}}) : original(input);
  });
  await R.init();
  const physics = new R.World({x:0,y:-24,z:0});
  t.after(() => physics.free());
  physics.createCollider(R.ColliderDesc.cuboid(10,.2,10).setTranslation(0,-.2,0));
  for (const side of [-1,1]) {
    physics.createCollider(R.ColliderDesc.cuboid(1,2,.1).setTranslation(side*2.24,2,0));
  }
  const leaves = [-1,1].map(side => {
    const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(side*1.94,1.97,0));
    physics.createCollider(R.ColliderDesc.cuboid(.62,1.93,.035), body);
    return {body};
  });
  const occupied = createDoorwayOccupancy(R,physics,{x:0,y:1.97,z:0},[1.24,1.93,.08],leaves);
  const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.89,2));
  const cart = physics.createCollider(R.ColliderDesc.cylinder(.85,MOVEMENT.cartRadius),body);
  const controller = physics.createCharacterController(.025);
  controller.enableSnapToGround(.25);
  physics.step();
  assert.equal(occupied(),false);
  for (const direction of [-1,1]) {
    let held = 0;
    for (let i = 0; i < 153; i++) {
      const p = body.translation();
      controller.computeColliderMovement(cart, {x:0,y:-.5 * FIXED_STEP,z:direction * MOVEMENT.cart * FIXED_STEP});
      const travel = controller.computedMovement();
      body.setNextKinematicTranslation({x:p.x+travel.x,y:p.y+travel.y,z:p.z+travel.z});
      physics.step();
      if (occupied()) held++;
    }
    assert.ok(direction * body.translation().z > 1.9, JSON.stringify(body.translation()));
    assert.ok(held > 30);
    assert.equal(occupied(),false);
  }
  // Empty space in the AABB of a diagonal cabinet must leave the spring arm clear.
  physics.createCollider(R.ColliderDesc.cuboid(2,1,.15).setTranslation(0,1,5)
    .setRotation({x:0,y:Math.sin(Math.PI/8),z:0,w:Math.cos(Math.PI/8)}));
  physics.step();
  const ball = new R.Ball(.22);
  const sweep = (x,z,length) =>
    sweepCameraClearance(physics,{x,y:1,z},identity,{x:1,y:0,z:0},ball,length,cart,body,[]);
  assert.equal(sweep(1.1,6.1,1),1);
  assert.ok(sweep(-3,5,4) < 3);
});

test('scene actions leave physics stepping to the fixed tick', async () => {
  const site = new URL('../demos/corporate/gjh/v11/', import.meta.url);
  const script = await readFile(new URL('script.js', site), 'utf8');
  const player = await readFile(new URL('assets/player.js', site), 'utf8');
  assert.equal(script.match(/physics\.step\(/g)?.length, 1);
  assert.doesNotMatch(player, /physics\.step\(/);
});
