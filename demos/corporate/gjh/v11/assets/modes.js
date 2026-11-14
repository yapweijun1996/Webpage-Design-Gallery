/** Interaction mode transitions; shelf is intentionally reserved without an entry edge. */
export const MODE_TRANSITIONS = Object.freeze({
  explore: Object.freeze(['menu', 'inspect', 'seated', 'cart', 'shop']),
  menu: Object.freeze(['explore', 'inspect', 'seated', 'cart', 'shop']),
  inspect: Object.freeze(['explore']),
  seated: Object.freeze(['explore', 'menu']),
  cart: Object.freeze(['explore', 'menu', 'shop']),
  shop: Object.freeze(['explore', 'menu', 'cart']),
  shelf: Object.freeze([]),
});
export function deriveMode(s) {
  if (s.productOpen) return 'inspect';
  if (s.bagOpen) return 'shop';
  if (s.panelOpen) return 'menu';
  if (s.seated) return 'seated';
  if (s.cartActive) return 'cart';
  return 'explore';
}

export function createModes({onEnter = () => {}, onExit = () => {}} = {}) {
  let mode = 'explore';
  let illegalCount = 0;
  const entries = [];
  function record(from, to, reason) {
    entries.push(Object.freeze({from, to, reason}));
    if (entries.length > 20) entries.shift();
  }
  return {
    current() { return mode; },
    illegalCount() { return illegalCount; },
    request(next, reason = '') {
      if (!MODE_TRANSITIONS[mode]?.includes(next)) { illegalCount++; record(mode, next, reason); return false; }
      const previous = mode;
      onExit(previous, next, reason);
      mode = next;
      onEnter(next, previous, reason);
      record(previous, next, reason);
      return true;
    },
    sync(next, reason = '') {
      if (next === mode) return true;
      const previous = mode;
      if (!MODE_TRANSITIONS[mode]?.includes(next)) illegalCount++;
      onExit(previous, next, reason);
      mode = next;
      onEnter(next, previous, reason);
      record(previous, next, reason);
      return true;
    },
    history() { return entries.slice(); },
  };
}
