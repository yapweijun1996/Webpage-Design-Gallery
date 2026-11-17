// Entries stay owned by the world; this adapter also sees entries added after startup.
export function createInteractionRegistry(entries, describe = () => ({})) {
  const cache = new WeakMap();
  const actions = new Map();
  const listeners = new Set();
  let selectionContext = {};
  function normalize(source) {
    let item = cache.get(source);
    if (!item) {
      const defaults = describe(source) || {};
      const anchor = source.anchor || {x: source.x, y: source.y ?? 0, z: source.z};
      item = {...defaults, ...source, anchor, x: anchor.x, y: anchor.y ?? source.y ?? 0, z: anchor.z,
        floor: source.floor ?? source.y ?? 0,
        availability: source.availability || defaults.availability || (() => true),
        prompt: source.prompt ?? defaults.prompt ?? '', handler: source.handler || defaults.handler};
      cache.set(source, item);
    }
    return item;
  }
  // Auxiliary actions share IDs with nearby entries but do not compete for
  // proximity selection (for example, pickup alongside shelf inspection).
  function register(source) {
    let byId = actions.get(source.kind);
    if (!byId) actions.set(source.kind, byId = new Map());
    const item = normalize(source);
    byId.set(item.id, item);
    return item;
  }
  function get(kind, id) {
    return actions.get(kind)?.get(id) || null;
  }
  function nearest(position, context = {}) {
    let selected = null, distance = Infinity;
    selectionContext = context;
    if (context.travelling) return {item: null, distance};
    for (const source of entries) {
      const item = normalize(source);
      const floor = typeof item.floor === 'number' ? item.floor : item.y;
      if (Math.abs((position.y ?? 0) - floor) > .5 || !item.availability(context, item)) continue;
      if (item.seat && (position.z - item.seat.z) * item.seat.facing > -.25) continue;
      const d = Math.hypot(position.x - item.anchor.x, position.z - item.anchor.z);
      if (d < item.radius && d < distance) { selected = item; distance = d; }
    }
    return {item: selected, distance};
  }
  function dispatch(item, context = selectionContext) {
    if (!item || (item.availability && !item.availability(context, item))) return false;
    const result = item.handler?.(item, context) ?? false;
    if (result) for (const listener of listeners) listener(item, context);
    return result;
  }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  return {normalize, nearest, dispatch, register, get, subscribe};
}
