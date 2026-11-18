const MIN_DISTANCE = 1;
const MAX_DISTANCE = 11;
const NARROW_FOV = 40;
const WIDE_FOV = 75;

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
