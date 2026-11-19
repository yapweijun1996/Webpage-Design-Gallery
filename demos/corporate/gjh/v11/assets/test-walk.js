import {MOVEMENT} from './movement.js';

export const TEST_ARRIVAL_RADIUS = .08;

export function testWalkInput(position, x, z, speed, maxSpeed = MOVEMENT.desktopWalk) {
  const dx = x - position.x, dz = z - position.z;
  const distance = Math.hypot(dx, dz);
  const yaw = distance < 1e-6 ? position.yaw : Math.atan2(-dx, -dz);
  // Give the normal decelerator room to stop before switching direction.
  const targetSpeed = Math.min(speed, distance * 5);
  return {yaw, forward: distance <= TEST_ARRIVAL_RADIUS ? 0 : targetSpeed / maxSpeed, right: 0};
}

export function createTestWalk({position, setInput, snapshot}) {
  let pending;
  function finish(error) {
    if (!pending) return;
    const {resolve, reject} = pending;
    pending = null;
    setInput(null);
    if (error) reject(new Error(error));
    else resolve(snapshot());
  }
  return {
    get active() { return Boolean(pending); },
    start(x, z, speed, maxSpeed, face = false) {
      if (pending) throw new Error('A test movement command is already running');
      if (![x, z, speed].every(Number.isFinite) || speed <= 0 || speed > maxSpeed) {
        throw new RangeError(`Expected finite coordinates and speed between 0 and ${maxSpeed} m/s`);
      }
      return new Promise((resolve, reject) => {
        pending = {x, z, speed, maxSpeed, face, resolve, reject, ticks:0, still:0};
      });
    },
    beforeTick() {
      if (!pending || pending.done) return;
      const {x, z, speed, maxSpeed, face} = pending;
      const p = position();
      const input = testWalkInput(p, x, z, speed, maxSpeed);
      setInput({...input, forward:face ? 0 : input.forward});
      pending.previous = p;
    },
    afterTick() {
      if (!pending || pending.done) return;
      const {x, z, face, previous, speed} = pending;
      const p = position();
      const moved = Math.hypot(previous.x - p.x, previous.z - p.z);
      const close = Math.hypot(x - p.x, z - p.z) <= TEST_ARRIVAL_RADIUS;
      pending.still = moved <= Math.min(.001, speed / 120) ? pending.still + 1 : 0;
      pending.ticks++;
      if ((face || close) && pending.still >= 3) pending.done = true;
      else if (pending.still >= 120 || pending.ticks >= 3600) {
        finish(`Could not walk to (${x}, ${z}); stopped at (${p.x.toFixed(3)}, ${p.z.toFixed(3)})`);
      }
    },
    presented() { if (pending?.done) finish(); },
    cancel(reason) { finish(reason); },
  };
}
