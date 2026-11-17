import {spatial, storeAt} from './spatial.js';
import {liftLayout} from './lift-layout.js';
// Stage 1 coordinates translated to preserve the three existing shop interiors.
// Plan origin is south-west; world X = plan X - 25, world Z = 48 - plan Y.
const slot = (number, side, minX, maxX, minZ, maxZ) => Object.freeze({
  number: String(number).padStart(2, '0'), side, minX, maxX, minZ, maxZ,
  available: true
});
export const expandedLayout = Object.freeze({
  bounds: Object.freeze({minX:-25, maxX:45, minZ:-12, maxZ:48}),
  entrance: Object.freeze({x:10, z:45}),
  courtyardArrival: Object.freeze({x:10, z:12}),
  lift: Object.freeze({x:liftLayout.x, z:liftLayout.z, upper:liftLayout.upper}),
  directory: liftLayout.directory,
  serviceDesk: liftLayout.desk,
  showcase: liftLayout.showcase,
  atrium: Object.freeze({x:10,z:12}),
  slots: Object.freeze([
    ...Array.from({length:5}, (_, i) => slot(i+1, 'north', -15+i*10, -5+i*10, -12, 0)),
    ...Array.from({length:6}, (_, i) => slot(i+6, 'west', -25, -15, i*8, (i+1)*8)),
    ...Array.from({length:6}, (_, i) => slot(i+12, 'east', 35, 45, i*8, (i+1)*8))
  ]),
  loop: Object.freeze([Object.freeze({x:-12,z:3}),Object.freeze({x:32,z:3}),
    Object.freeze({x:32,z:39}),Object.freeze({x:-12,z:39})])
});
// Slot geometry owns availability. Display names come from the brand kit and
// are also present in the static directory for visitors without JavaScript.
export const plannedSpaces = Object.freeze(expandedLayout.slots.slice(3).map(slot => Object.freeze({
  id: `planned-space-${slot.number}`, number: slot.number, side: slot.side,
  status: 'open', available: slot.available
})));

// Facade normal points from the shop into the arcade, and its lateral axis
// follows the local positive X of the window studio and door leaf meshes.
export function shopEntrance(slot) {
  const normalX = slot.side === 'west' ? 1 : slot.side === 'east' ? -1 : 0;
  const normalZ = slot.side === 'north' ? 1 : 0;
  return {
    x:normalX > 0 ? slot.maxX : normalX < 0 ? slot.minX : (slot.minX+slot.maxX)/2,
    z:normalZ ? slot.maxZ : (slot.minZ+slot.maxZ)/2,
    normalX, normalZ, alongX:normalZ, alongZ:-normalX, yaw:Math.atan2(normalX,normalZ)
  };
}
const shopArrivals = new Map(plannedSpaces.map(store => {
  const entrance = shopEntrance(expandedLayout.slots[Number(store.number)-1]);
  return [store.id,Object.freeze({x:entrance.x+2.4*entrance.normalX,z:entrance.z+2.4*entrance.normalZ,yaw:entrance.yaw})];
}));
export const expandedStoreArrival = id => shopArrivals.get(id) || spatial.arrival(id);
export function expandedStoreAt(x,z) {
  const original=storeAt(x,z,true);
  if(original)return original;
  const index=expandedLayout.slots.findIndex((slot,i)=>i>=3 && x>slot.minX && x<slot.maxX && z>slot.minZ && z<slot.maxZ);
  return index>=3 ? plannedSpaces[index-3] : null;
}

export const expandedMapPoint = (x,z) => ({
  x: Math.max(0, Math.min(700, (x + 25) * 10)),
  y: Math.max(0, Math.min(600, (z + 12) * 10))
});
