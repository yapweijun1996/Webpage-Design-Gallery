const MIN_DISTANCE = 1;
const MAX_DISTANCE = 11;
const NARROW_FOV = 40;
const WIDE_FOV = 75;
const MIN_CHASE_PITCH = -30 * Math.PI / 180;
const MAX_CHASE_PITCH = 75 * Math.PI / 180;
const MAX_EYE_PITCH = 85 * Math.PI / 180;
const CAMERA_AXES = ['x', 'y', 'z'];
export const DEFAULT_PITCH = .1;

export function clampCameraPitch(value, mode) {
  const eye = mode === 'first-person';
  return Math.max(eye ? -MAX_EYE_PITCH : MIN_CHASE_PITCH, Math.min(eye ? MAX_EYE_PITCH : MAX_CHASE_PITCH, value));
}

export function neutralFramingWeight(pitch) {
  const limit = pitch < DEFAULT_PITCH ? MIN_CHASE_PITCH : MAX_CHASE_PITCH;
  return Math.max(0, 1 - Math.abs((pitch - DEFAULT_PITCH) / (limit - DEFAULT_PITCH)));
}

export function limitCameraByFloor(originY, directionY, length, minimumY) {
  return directionY < 0 ? Math.min(length, Math.max(0, (originY - minimumY) / -directionY)) : length;
}

export function limitCameraByObstacles(origin, direction, length, radius, obstacles) {
  let clearance = length;
  for (const box of obstacles) {
    let near = 0, far = clearance;
    for (const axis of CAMERA_AXES) {
      const min = box.min[axis] - radius, max = box.max[axis] + radius;
      if (Math.abs(direction[axis]) < 1e-8) {
        if (origin[axis] < min || origin[axis] > max) { far = -1; break; }
        continue;
      }
      const a = (min - origin[axis]) / direction[axis], b = (max - origin[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (far < near) break;
    }
    if (far >= near) clearance = Math.min(clearance, Math.max(0, near - .02));
  }
  return clearance;
}

export function clampZoom(value) {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

// Preserve the existing viewport-dependent framing at neutral zoom.
export function chaseDistance(neutral, zoom) {
  const value = clampZoom(zoom);
  return neutral - value * (value < 0 ? MAX_DISTANCE - neutral : neutral - MIN_DISTANCE);
}

export function firstPersonFov(zoom) {
  return WIDE_FOV - (clampZoom(zoom) + 1) * (WIDE_FOV - NARROW_FOV) / 2;
}

export function easeCameraValue(current, target, dt, immediate = false) {
  if (immediate || Math.abs(target - current) < .0001) return target;
  return current + (target - current) * -Math.expm1(-6 * Math.max(0, dt));
}

export function createCameraController(getStorage = () => globalThis.sessionStorage) {
  const key = 'gjh.v11.cameraZoom';
  let chaseZoom = 0, eyeZoom = 0, firstPerson = false;
  let chasePitch = DEFAULT_PITCH, eyePitch = DEFAULT_PITCH;
  try {
    const saved = JSON.parse(getStorage().getItem(key));
    chaseZoom = clampZoom(saved?.chase);
    eyeZoom = clampZoom(saved?.eye);
  } catch { /* In-memory zoom remains available without session storage. */ }
  return {
    get firstPerson() { return firstPerson; },
    mode(chaseRequired = false) {
      return firstPerson && !chaseRequired ? 'first-person' : 'third-person';
    },
    zoom(chaseRequired = false) {
      return chaseRequired ? 0 : firstPerson ? eyeZoom : chaseZoom;
    },
    pitch(chaseRequired = false) {
      return firstPerson && !chaseRequired ? eyePitch : chasePitch;
    },
    setPitch(value, chaseRequired = false) {
      if (!Number.isFinite(value)) return;
      if (firstPerson && !chaseRequired) eyePitch = clampCameraPitch(value, 'first-person');
      else chasePitch = clampCameraPitch(value, 'third-person');
    },
    toggle(chaseRequired = false) {
      if (chaseRequired) return false;
      firstPerson = !firstPerson;
      return true;
    },
    adjust(delta, chaseRequired = false) {
      if (chaseRequired || !Number.isFinite(delta)) return false;
      const previous = firstPerson ? eyeZoom : chaseZoom;
      const next = clampZoom(previous + delta);
      if (next === previous) return false;
      if (firstPerson) eyeZoom = next; else chaseZoom = next;
      try { getStorage().setItem(key, JSON.stringify({chase: chaseZoom, eye: eyeZoom})); } catch {}
      return true;
    }
  };
}
