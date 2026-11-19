export const FIXED_STEP = 1 / 60;
export const MOVEMENT = Object.freeze({
  desktopWalk: 3.4, desktopRun: 5.2, touchWalk: 3.1, touchRun: 4.5, cart: 1.8,
  acceleration: 10, deceleration: 18, turnRate: 140 * Math.PI / 180,
  stickDeadZone: .12, stepHeight: .18, cartRadius: .95,
  walkClipSpeed: 2.65, runClipSpeed: 5
});

export function stickStrength(distance, radius) {
  const dead = MOVEMENT.stickDeadZone;
  return Math.max(0, Math.min(1, (distance / radius - dead) / (1 - dead)));
}

export function advanceVelocity(velocity, forward, right, yaw, speed, dt) {
  const magnitude = Math.hypot(forward, right);
  const scale = speed / Math.max(1, magnitude);
  const x = (Math.cos(yaw) * right - Math.sin(yaw) * forward) * scale;
  const z = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * scale;
  const dx = x - velocity.x, dz = z - velocity.z;
  const difference = Math.hypot(dx, dz);
  if (!difference) return;
  const braking = x * velocity.x + z * velocity.z < 0 ||
    Math.hypot(x, z) < Math.hypot(velocity.x, velocity.z) - 1e-8;
  const fraction = Math.min(1, (braking ? MOVEMENT.deceleration : MOVEMENT.acceleration) * dt / difference);
  velocity.x += dx * fraction;
  velocity.z += dz * fraction;
}

export function createFixedClock() {
  let remaining = 0;
  return {
    reset() { remaining = 0; },
    advance(seconds, tick) {
      remaining = Math.min(.1, remaining + Math.max(0, seconds));
      let steps = 0;
      while (remaining + 1e-9 >= FIXED_STEP) {
        tick();
        remaining = Math.max(0, remaining - FIXED_STEP);
        steps++;
      }
      return steps;
    },
    get alpha() { return remaining / FIXED_STEP; }
  };
}

export function interpolate(from, to, alpha) {
  return from + (to - from) * alpha;
}

export function interpolateAngle(from, to, alpha) {
  const difference = to - from;
  return from + Math.atan2(Math.sin(difference), Math.cos(difference)) * alpha;
}
