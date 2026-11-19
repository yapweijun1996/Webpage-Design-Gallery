import {isInFrontOfSeat} from './seat-placements.js';

function distanceToInteraction(item, position, context) {
  const floor = typeof item.floor === 'number' ? item.floor : item.y;
  if (Math.abs((position.y ?? 0) - floor) > .5 || !item.availability(context, item)) return Infinity;
  if (item.seat && !isInFrontOfSeat(item.seat, position)) return Infinity;
  const point = item.standing ?? item.anchor;
  const distance = item.shopAction?.seated && context.player?.seated ? 0 :
    Math.hypot(position.x - point.x, position.z - point.z);
  return distance < item.radius ? distance : Infinity;
}

export function createInteractionState({announce = () => {}, begin = () => {}, present = () => {}} = {}) {
  const states = new Map();
  const idle = Object.freeze({phase: 'idle', message: ''});
  let focused = null, active = null, displayed = null, dirty = false;
  const read = id => states.get(id) ?? idle;
  function set(item, phase, message = '') {
    states.set(item.id, {phase, message});
    if (message) announce(message);
  }
  function focus(item) {
    if (focused === item) return;
    if (focused && read(focused.id).phase === 'focused') states.delete(focused.id);
    focused = item;
    dirty = true;
    if (item && read(item.id).phase === 'idle') set(item, 'focused');
  }
  function start(item) {
    if (active) return active.item === item && cancel();
    active = {item, elapsed: 0, stop:begin(item)};
    set(item, 'executing', item.shopAction.progress);
    return true;
  }
  function cancel() {
    if (!active) return false;
    active.stop?.();
    set(active.item, 'cancelled', 'Cancelled. Try again.');
    active = null;
    dirty = true;
    return true;
  }
  function advance(zone, delta, reducedMotion = false) {
    let changed = false;
    if (active && active.item.shopAction.zone !== zone) changed = cancel();
    if (active) {
      const {item} = active;
      active.elapsed += delta;
      const progress = reducedMotion || !item.shopAction.duration ? 1 :
        Math.min(1, active.elapsed / item.shopAction.duration);
      present(item, progress);
      displayed = item;
      if (progress < 1) return changed;
      set(item, 'done', item.shopAction.done);
      active = null;
      changed = true;
    }
    const resting = focused && focused.shopAction.zone === zone &&
      read(focused.id).phase === 'done' ? focused : null;
    if (resting !== displayed) {
      present(resting, 1);
      displayed = resting;
    }
    dirty = false;
    return changed;
  }
  return {read, focus, start, cancel, advance,
    get needsFrame() { return Boolean(active || dirty); }};
}

// Entries stay owned by the world; this adapter also sees entries added after startup.
export function createInteractionRegistry(entries, describe = () => ({})) {
  const cache = new WeakMap();
  const actions = new Map();
  const listeners = new Set();
  const candidates = [];
  let selectionContext = {}, selected = null, cycled = null, shops = null;
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
    let best = null, distance = Infinity;
    selectionContext = context;
    const shopEntries = context.travelling ? null : shops?.byZone.get(context.zone);
    candidates.length = 0;
    function consider(source) {
      const item = normalize(source);
      const d = distanceToInteraction(item, position, context);
      if (d === Infinity) return;
      if (shopEntries && (!context.player?.seated || item.shopAction?.seated)) {
        // Native actions and playable props break distance ties before exhibits.
        const rank = !item.shopAction ? 0 : item.shopAction.effect ? 1 : 2;
        candidates.push({item, distance:d, rank});
      }
      if (d < distance) {
        best = item;
        distance = d;
      }
    }
    if (!context.travelling) for (const source of entries) consider(source);
    if (shopEntries) for (const source of shopEntries) consider(source);
    if (candidates.length) {
      candidates.sort((a,b) => a.distance - b.distance || a.rank - b.rank);
      const primary = candidates[0];
      // Keep the original shelf prompt first when its drawer is closest.
      const shelf = primary.item.shopAction?.productId &&
        candidates.findIndex(({item}) => item.id === primary.item.shopAction.productId);
      if (shelf > 0) candidates.unshift(...candidates.splice(shelf,1));
      ({item:best, distance} = candidates[0]);
    }
    const chosen = cycled && candidates.find(candidate => candidate.item === cycled);
    if (!chosen) cycled = null;
    selected = chosen?.item ?? best;
    shops?.state.focus(selected?.shopAction ? selected : null);
    return {item: selected, distance: chosen?.distance ?? distance};
  }
  function cycle(direction) {
    if (!canCycle()) return false;
    const index = candidates.findIndex(candidate => candidate.item === selected);
    const next = index < 0 ? (direction < 0 ? candidates.length - 1 : 0) :
      (index + direction + candidates.length) % candidates.length;
    cycled = candidates[next].item;
    return true;
  }
  function canCycle() {
    return candidates.length > 1 && candidates.some(({item}) => item.shopAction);
  }
  function dispatch(item, context = selectionContext) {
    if (!item || (item.availability && !item.availability(context, item))) return false;
    let result;
    if (item.shopAction) {
      if (item !== selected) return false;
      const {productId} = item.shopAction;
      const pickup = productId && get('pickup', productId);
      if (pickup && shops.state.read(item.id).phase === 'done') return dispatch(pickup, context);
      result = shops.state.start(item);
    } else result = item.handler?.(item, context) ?? false;
    if (result) for (const listener of listeners) listener(item, context);
    return result;
  }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  return {normalize, nearest, dispatch, register, get, subscribe, cycle, canCycle,
    installShopActions(targets, presentation) {
      shops = {byZone:new Map(), state:createInteractionState(presentation)};
      for (const item of targets) {
        const zone = item.shopAction.zone;
        if (!shops.byZone.has(zone)) shops.byZone.set(zone, []);
        shops.byZone.get(zone).push(item);
      }
    },
    shopState: id => shops?.state.read(id),
    productTarget(item) {
      const id = item?.shopAction?.productId;
      return id && shops?.state.read(item.id).phase === 'done' ? id : item?.id ?? null;
    },
    advanceShopActions: (zone, delta, reducedMotion) =>
      shops?.state.needsFrame && shops.state.advance(zone, delta, reducedMotion),
    cancelShopAction: () => shops?.state.cancel()};
}
