/** Gameplay belongs to the player; UI overlays suspend it without changing posture. */
const BASE_EDGES = Object.freeze({explore: ['seated', 'cart'], seated: ['explore'], cart: ['explore']});
const OVERLAYS = new Set(['menu', 'inspect', 'shop']);
const SIGNALS = ['seated', 'cartActive', 'panelOpen', 'productOpen', 'bagOpen'];

export function deriveMode(s) {
  if (s.productOpen) return 'inspect';
  if (s.bagOpen) return 'shop';
  if (s.panelOpen) return 'menu';
  if (s.seated) return 'seated';
  if (s.cartActive) return 'cart';
  return 'explore';
}

export function createModes({onExit = () => {}, onCleanup = () => {}, onEnter = () => {},
  onSuspend = () => {}, onRestore = () => {}} = {}) {
  let layers = ['explore'], illegalCount = 0;
  const entries = [];
  const current = () => layers.at(-1);
  function record(entry) {
    entries.push(Object.freeze(entry));
    if (entries.length > 20) entries.shift();
  }
  function reject(to, reason) {
    illegalCount++;
    record({from: current(), to, reason, kind: 'reject'});
    return false;
  }
  function commit(next, reason) {
    if (next.length === layers.length && next.every((mode, i) => mode === layers[i])) return true;
    const from = current(), to = next.at(-1);
    const restore = layers.slice(0, -1).includes(to) && next.every((mode, i) => mode === layers[i]);
    const suspend = from !== to && next.slice(0, -1).includes(from);
    const event = Object.freeze({from, to, reason, kind: from === to ? 'underlay' : restore ? 'restore' : suspend ? 'suspend' : 'enter'});
    if (from !== to) onExit(from, to, event);
    onCleanup(event);
    if (suspend) onSuspend(from, to, event);
    layers = next;
    if (from !== to) {
      onEnter(to, from, event);
      if (restore) onRestore(to, from, event);
    }
    record(event);
    return true;
  }
  return {
    current,
    paused() { return layers.length > 1; },
    layers() { return layers.slice(); },
    illegalCount() { return illegalCount; },
    // Commands can cover a running mode or restore its immediate retained owner.
    // They cannot manufacture a seated/cart posture; only player observations can.
    request(next, reason = '') {
      if (typeof next !== 'string' || (!OVERLAYS.has(next) && !Object.hasOwn(BASE_EDGES, next))) return reject(next, reason);
      if (next === current()) return true;
      if (layers.length > 1 && next === layers.at(-2)) return commit(layers.slice(0, -1), reason);
      if (!OVERLAYS.has(next) || (layers.length > 1 && current() !== 'menu') || layers.includes(next))
        return reject(next, reason);
      return commit([...layers, next], reason);
    },
    // Complete owner snapshots replace the old forced sync API. Validate the whole
    // observation before any lifecycle effects, including changes under an overlay.
    observe(signals, reason = 'UI/player observation') {
      if (!signals || typeof signals !== 'object' || Array.isArray(signals) || Object.keys(signals).some(key => !SIGNALS.includes(key)) ||
          SIGNALS.some(key => typeof signals[key] !== 'boolean') ||
          (signals.seated && signals.cartActive) || (signals.productOpen && signals.bagOpen))
        return reject('invalid-observation', reason);
      const base = signals.seated ? 'seated' : signals.cartActive ? 'cart' : 'explore';
      if (base !== layers[0] && !BASE_EDGES[layers[0]].includes(base)) return reject(base, reason);
      const next = [base];
      if (signals.panelOpen) next.push('menu');
      if (signals.productOpen) next.push('inspect');
      if (signals.bagOpen) next.push('shop');
      // Inspect and Shop can return to retained layers, but cannot replace each
      // other directly. Their native dialogs must close before opening another.
      if (['inspect', 'shop'].includes(current()) && ['inspect', 'shop'].includes(next.at(-1)) && current() !== next.at(-1))
        return reject(next.at(-1), reason);
      return commit(next, reason);
    },
    interrupt(reason) {
      const event = Object.freeze({from: current(), to: current(), reason, kind: 'interrupt'});
      onCleanup(event);
      record(event);
    },
    history() { return entries.slice(); },
  };
}
