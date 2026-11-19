import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceVelocity, FIXED_STEP, MOVEMENT} from '../demos/corporate/gjh/v11/assets/movement.js';
import {createTestWalk, TEST_ARRIVAL_RADIUS, testWalkInput} from '../demos/corporate/gjh/v11/assets/test-walk.js';

function fixture(move = true) {
  const position = {x:0, z:0, yaw:0}, velocity = {x:0, z:0};
  let input;
  const motor = createTestWalk({position:() => ({...position}), setInput:next => { input = next; },
    snapshot:() => ({...position})});
  function tick() {
    motor.beforeTick();
    if (input) {
      if (Number.isFinite(input.yaw)) position.yaw = input.yaw;
      advanceVelocity(velocity, input.forward, input.right, position.yaw, MOVEMENT.desktopWalk, FIXED_STEP);
      if (move) {
        position.x += velocity.x * FIXED_STEP;
        position.z += velocity.z * FIXED_STEP;
      }
    }
    motor.afterTick();
  }
  return {motor, tick, position, get input() { return input; }};
}

test('walking uses bounded analog input and resolves only after the arriving frame', async () => {
  const f = fixture(), target = {x:-2.3,z:3.75};
  const movement = f.motor.start(target.x, target.z, 1.7, MOVEMENT.desktopWalk);
  assert.throws(() => f.motor.start(1, 2, 1, 3.4), /already running/);
  let settled = false;
  movement.then(() => { settled = true; });
  for (let i = 0; i < 240; i++) f.tick();
  await Promise.resolve();
  assert.equal(settled, false);
  assert(Math.hypot(f.position.x - target.x, f.position.z - target.z) <= TEST_ARRIVAL_RADIUS);
  assert.equal(f.input.forward, 0);
  f.motor.presented();
  assert.deepEqual(await movement, f.position);
  assert.equal(f.input, null);
});

test('facing stops in place and turns toward a world-space point', async () => {
  const f = fixture();
  const facing = f.motor.start(1, 0, 1, MOVEMENT.desktopWalk, true);
  for (let i = 0; i < 3; i++) f.tick();
  f.motor.presented();
  assert.deepEqual(await facing, {x:0, z:0, yaw:-Math.PI / 2});
  assert.deepEqual(testWalkInput({x:0,z:0}, 0, 0, 1), {yaw:undefined, forward:0, right:0});
});

test('blocked or interrupted moves reject and release virtual input', async () => {
  const f = fixture(false);
  assert.throws(() => f.motor.start(NaN, 0, 1, 3.4), RangeError);
  assert.throws(() => f.motor.start(0, 0, 4, 3.4), RangeError);
  const blocked = f.motor.start(0, 3, 1, MOVEMENT.desktopWalk);
  for (let i = 0; i < 120; i++) f.tick();
  await assert.rejects(blocked, /stopped at/);
  assert.equal(f.input, null);
  const interrupted = f.motor.start(0, 1, 1, MOVEMENT.desktopWalk);
  f.tick();
  f.motor.cancel('Focus changed');
  await assert.rejects(interrupted, /Focus changed/);
  assert.equal(f.input, null);
});
