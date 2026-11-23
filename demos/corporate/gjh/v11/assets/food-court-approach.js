const loadCourt = (options, signal) => import('./food-court.js').then(module => module.loadFoodCourt(options, signal));

// A second independent lease keeps the original street usable while the four court models load.
export function createFoodCourtApproach(options, load = loadCourt) {
  let status = 'distant', nearby = false, request, prepared, active, disposed = false;
  const contains = (x,z) => x >= 17.4 && x <= 30.6 && z >= 83.8 && z <= 93.6;
  function retire() {
    request?.abort();
    request = undefined;
    prepared?.dispose();
    active?.dispose();
    prepared = active = undefined;
    status = 'distant';
  }
  async function approach() {
    const attempt = new AbortController();
    request = attempt;
    status = 'loading';
    const timeout = setTimeout(() => attempt.abort(), 20000);
    try {
      const court = await load(options,attempt.signal);
      if (attempt.signal.aborted || request !== attempt || disposed) {
        court.dispose();
        throw new DOMException('Court request cancelled','AbortError');
      }
      prepared = court;
      status = 'staged';
    } catch {
      if (!disposed && request === attempt) status = 'unavailable';
    } finally {
      clearTimeout(timeout);
      if (request === attempt) request = undefined;
    }
  }
  return {
    update(x,z) {
      if (disposed) return;
      const distance = Math.hypot(Math.max(17.4-x,0,x-30.6),Math.max(83.8-z,0,z-93.6));
      // The straight south-gate pavement passes 7.4 m west of the parcel.
      nearby = distance > 0 && distance < 9;
      if (distance > 19 || (status === 'unavailable' && distance > 12)) {
        if (status !== 'distant') retire();
      } else if (status === 'distant' && distance < 10) {
        void approach();
      } else if (prepared && prepared.safeToMount(x,z)) {
        try {
          prepared.mount();
          active = prepared;
          status = 'ready';
        } catch {
          prepared.dispose();
          status = 'unavailable';
        }
        prepared = undefined;
      }
    },
    contains(x,z) { return Boolean(active) && contains(x,z); },
    get notice() {
      if (active && nearby) return 'Food court beside the last row of shophouses.';
      if (status === 'unavailable') return 'Food court unavailable. Step away and return to retry.';
      if (status === 'staged') return 'Step clear of the stall furniture to open the food court.';
      return '';
    },
    get state() { return {status,...active?.counts}; },
    dispose() { disposed = true; retire(); }
  };
}
