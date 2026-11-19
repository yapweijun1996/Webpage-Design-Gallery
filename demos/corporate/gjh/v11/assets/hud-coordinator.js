import {icon} from './icons.js';

const priority = ['held', 'interaction', 'nearby', 'quest'];
const goalKeys = ['visit', 'inspect', 'bag'];
const goalTargets = [3, 1, 1];
const goalHints = ['Walk into three different stores', 'Inspect a product at New Moon', 'Add a product to the demo bag'];
const bearings = ['Ahead', 'Ahead right', 'Right', 'Behind right', 'Behind', 'Behind left', 'Left', 'Ahead left'];

export function createContextQueue() {
  const sources = new Map();
  return {
    set(source, value) {
      if (value) sources.set(source, value);
      else sources.delete(source);
    },
    current() {
      const kind = priority.find(source => sources.has(source));
      return kind ? {kind, value: sources.get(kind)} : null;
    },
  };
}

export function createObjectiveTracker(storeIds, initialBag = {}) {
  const stores = new Set(storeIds), visited = new Set();
  let inspected = false, added = false, bag = initialBag;
  return {
    visit(id) { if (stores.has(id) && visited.size < goalTargets[0]) visited.add(id); },
    inspect() { inspected = true; },
    bag(next) {
      added ||= Object.keys(next).some(id => next[id] > (bag[id] ?? 0));
      bag = next;
    },
    progress() { return [visited.size, Number(inspected), Number(added)]; },
  };
}

export function nearbyStore(position, forward, destinations, currentStore, range = 20) {
  let target = null, distance = range;
  for (const store of destinations) {
    if (store.id === currentStore || !store.available || !store.arrival) continue;
    const dx = store.arrival.x - position.x, dz = store.arrival.z - position.z;
    const metres = Math.hypot(dx, dz);
    if (!Number.isFinite(metres) || metres > distance || (target && metres === distance)) continue;
    const validHeading = Math.hypot(forward.x, forward.z) > 1e-6 && metres > .15;
    const angle = Math.atan2(dx * -forward.z + dz * forward.x, dx * forward.x + dz * forward.z);
    const sector = validHeading ? (Math.round(angle / (Math.PI / 4)) + 8) % 8 : null;
    distance = metres;
    target = {id: store.id, label: store.label, metres: Math.round(metres), sector};
  }
  return target;
}

export function createMallHud({destinations, announce, scene, subscribeBag, subscribeInspect}) {
  const byId = id => document.getElementById(id);
  const context = byId('hud-context'), held = byId('held-product-status'), hint = byId('hud-context-hint');
  const hintText = byId('hud-context-text'), arrow = byId('hud-nearby-arrow'), direction = byId('hud-nearby-direction');
  const prompt = byId('inspect-prompt'), nearbyName = byId('nearby-name'), inspect = byId('inspect');
  const more = byId('hud-more-actions');
  const total = byId('hud-objective-total'), toast = byId('hud-objective-toast');
  const dots = [...document.querySelectorAll('.hud-objective-dots i')];
  const progressLabels = goalKeys.map(key => document.querySelector(`[data-hud-progress="${key}"]`));
  const queue = createContextQueue();
  const stores = destinations.filter(store => store.available).map(store => store.id);
  const textSources = new WeakMap();
  let tracker, objectiveState = '', completionPending = false, toastTimeout;
  let pickupAction, lastSample = -Infinity, lastAnnouncement = '', lastZone, active = false;
  function text(node, value) {
    // Keep the source stable when the page's language observer translates it.
    if (textSources.get(node) === value) return;
    textSources.set(node, value);
    node.textContent = value;
  }
  function hide(node, value) {
    if (node.hidden !== value) node.hidden = value;
  }
  function setMore(open, restore = false) {
    prompt.classList.toggle('hud-actions-open', open);
    more.setAttribute('aria-expanded', String(open));
    if (restore && !more.hidden) more.focus({preventScroll: true});
  }
  more.addEventListener('click', () => setMore(more.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('pointerdown', event => {
    if (!prompt.contains(event.target) && !event.target.closest('dialog[open]') &&
        prompt.classList.contains('hud-actions-open')) setMore(false);
  });
  prompt.addEventListener('keydown', event => {
    if (event.key === 'Escape' && prompt.classList.contains('hud-actions-open')) {
      event.stopPropagation();
      setMore(false, true);
    }
  });
  // Dialog focus restoration uses the same Inspect button while its chooser is open.
  subscribeInspect(() => {
    tracker.inspect();
    updateGoals();
  });
  subscribeBag(items => {
    if (!tracker) tracker = createObjectiveTracker(stores, items);
    else tracker.bag(items);
    updateGoals();
  });

  function updateGoals() {
    const progress = tracker.progress(), state = progress.join('/');
    if (objectiveState === state) return;
    objectiveState = state;
    let completed = 0;
    progress.forEach((value, index) => {
      const done = value === goalTargets[index];
      completed += Number(done);
      dots[index].classList.toggle('is-complete', done);
      text(progressLabels[index], `${value} / ${goalTargets[index]}`);
    });
    text(total, `${completed} of 3 objectives complete`);
    const nextGoal = progress.findIndex((value, i) => value < goalTargets[i]);
    if (nextGoal === -1) completionPending = true;
    queue.set('quest', goalHints[nextGoal]);
  }

  function render() {
    const selected = queue.current();
    hide(context, !active || !selected);
    if (!active) return;
    if (!selected) {
      if (completionPending) showCompletion();
      return;
    }
    if (context.dataset.context !== selected.kind) context.dataset.context = selected.kind;
    const isNearby = selected.kind === 'nearby';
    const sector = isNearby ? selected.value.sector : null;
    const showArrow = sector !== null;
    hide(hint, !isNearby && selected.kind !== 'quest');
    hide(arrow, !showArrow);
    hide(direction, !showArrow);
    if (isNearby) text(hintText, `${selected.value.label} · ${selected.value.metres} m`);
    if (selected.kind === 'quest') text(hintText, selected.value);
    if (showArrow) {
      const angle = `rotate(${sector * 45}deg)`;
      if (arrow.style.transform !== angle) arrow.style.transform = angle;
      text(direction, bearings[sector]);
    }
    const message = selected.kind === 'held' ? held.textContent :
      selected.kind === 'interaction' ? nearbyName.textContent : '';
    if (message && lastAnnouncement !== message) announce(message);
    lastAnnouncement = message;
    if (completionPending) showCompletion();
  }
  function showCompletion() {
    completionPending = false;
    const message = 'All mall objectives complete!';
    text(toast, message);
    hide(toast, false);
    announce(message);
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => hide(toast, true), 4200);
  }

  return {
    connectProductActions({pickup, add, putBack, notice}) {
      pickupAction = pickup;
      pickup.classList.add('hud-control', 'hud-pickup-action');
      for (const action of [add, putBack]) action.classList.add('hud-control', 'hud-held-action');
      notice.removeAttribute('role');
      notice.id = 'hud-product-note';
      notice.classList.add('sr-only');
      pickup.setAttribute('aria-describedby', notice.id);
    },
    update({position, zone, enabled, travelling, now, forward}) {
      active = enabled;
      if (active && lastZone !== zone) {
        lastZone = zone;
        tracker.visit(zone);
        updateGoals();
      }
      const showHeld = !held.hidden;
      const canInteract = !showHeld && !prompt.hidden;
      const usePhysical = Boolean(canInteract && pickupAction && !pickupAction.hidden && !pickupAction.disabled);
      const secondary = usePhysical && !inspect.hidden && !inspect.disabled;
      if (inspect.classList.contains('hud-alternate-action') !== secondary) {
        inspect.classList.toggle('hud-alternate-action', secondary);
        setMore(secondary && document.activeElement === inspect);
        if (!secondary && document.activeElement === more) {
          (canInteract && !inspect.disabled ? inspect : scene).focus({preventScroll: true});
        }
      }
      hide(more, !secondary);
      pickupAction?.classList.toggle('hud-unavailable-action', !usePhysical);
      queue.set('held', showHeld);
      queue.set('interaction', canInteract);
      if (!active || zone === 'upper' || travelling || canInteract || showHeld) {
        queue.set('nearby', null);
      } else if (now - lastSample >= 100) {
        lastSample = now;
        queue.set('nearby', nearbyStore(position, forward, destinations, zone));
      }
      render();
    },
    suspend() {
      active = false;
      hide(context, true);
      lastAnnouncement = '';
    },
  };
}
