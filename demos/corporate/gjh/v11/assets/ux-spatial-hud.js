import {mapPoint} from './spatial.js';
import {storeDestinations} from './store-destinations.js';
import {expandedMapPoint} from './expanded-layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function setAttribute(element, name, value) {
  const text = String(value);
  if (element && element.getAttribute(name) !== text) element.setAttribute(name, text);
}

// Call only after createUI has configured the shared map and its service markers.
// This is a second DOM view of that map, never another scene or renderer.
export function createSpatialHud({expanded = false, root = document} = {}) {
  const shops = new Map(storeDestinations(expanded, root).map(store => [store.id, store]));
  const floor = root.getElementById('floor-indicator');
  const target = root.getElementById('nearest-target');
  const interact = root.getElementById('control-interact');
  const miniMap = root.getElementById('mini-map');
  const plan = root.getElementById('mini-map-plan');
  const source = root.querySelector('.floorplan');
  const map = source && plan ? source.cloneNode(true) : null;
  const dot = map?.querySelector('#player-dot');
  let heading = null, context = null;
  if (map) {
    for (const element of [map, ...map.querySelectorAll('*')]) {
      for (const name of element.getAttributeNames()) {
        if (name === 'id' || name.startsWith('data-')) element.removeAttribute(name);
      }
    }
    map.setAttribute('class', 'mini-map-floorplan');
    map.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (dot) {
      dot.classList.add('mini-map-player');
      dot.setAttribute('fill', 'var(--gjh-color-player-dot)');
      dot.setAttribute('stroke', 'var(--green)');
      dot.setAttribute('stroke-width', '3');
      const radius = Number(dot.getAttribute('r')) || 6;
      heading = root.createElementNS(SVG_NS, 'path');
      heading.setAttribute('class', 'mini-map-heading');
      heading.setAttribute('d', `M0 ${-radius * 2.7} L${-radius * .8} ${-radius * 1.2} L${radius * .8} ${-radius * 1.2} Z`);
      heading.setAttribute('fill', 'var(--green)');
      map.append(heading);
    }
    context = root.createElement('p');
    context.className = 'mini-map-context';
    plan.replaceChildren(map, context);
  }
  function suspend() {
    if (interact) interact.hidden = true;
    if (target) target.hidden = true;
  }
  suspend();
  return {
    suspend,
    update({position, zone = 'atrium', interaction = null, distance = Infinity,
      targetLabel = '', active = false, usable = true, travelling = false}) {
      const upper = zone === 'upper';
      const floorLabel = upper ? 'Floor 02 - Upper Level' : 'Floor 01 - Atrium';
      const shop = !upper && shops.get(zone);
      setText(floor, shop ? `${floorLabel} · ${shop.label}` : floorLabel);
      const mapContext = travelling ? 'Ground-floor plan · Lift in transit' : upper
        ? 'Ground-floor plan · You are on Floor 02' : 'Ground-floor plan · You are here';
      setText(context, mapContext);
      setAttribute(map, 'aria-label', mapContext);
      if (miniMap) miniMap.dataset.floor = upper ? '02' : '01';
      if (position && Number.isFinite(position.x) && Number.isFinite(position.z)) {
        const point = expanded ? expandedMapPoint(position.x, position.z) : mapPoint(position.x, position.z);
        setAttribute(dot, 'cx', point.x);
        setAttribute(dot, 'cy', point.y);
        const angle = -(position.yaw || 0) * 180 / Math.PI;
        setAttribute(heading, 'transform', `translate(${point.x} ${point.y}) rotate(${angle})`);
      }
      // The cloned plan describes the ground floor only, just like the full map.
      // Do not pretend an upper-floor or moving-lift position is on that floor.
      if (dot) dot.style.display = upper || travelling ? 'none' : '';
      if (heading) heading.style.display = upper || travelling ? 'none' : '';
      // Range/floor/availability are decided by the existing interaction registry.
      // No second proximity rule or candidate scan belongs in this DOM view.
      const near = Boolean(active && !travelling && usable && interaction && Number.isFinite(distance));
      if (interact) interact.hidden = !near;
      const label = targetLabel.trim();
      if (target) {
        target.hidden = !near || !label;
        if (near && label) setText(target, `Nearest: ${label} · ${distance.toFixed(1)} m`);
      }
    },
  };
}
