import {miliSeats} from './interiors/mili-seats.js';
import {atriumLayout} from './atrium-layout.js';
import {liftLayout} from './lift-layout.js';
import {spatial, storeCenterX} from './spatial.js';
import {INTERIOR_PILOT} from './interior-pilot-registry.js';

// The GLB origin is at floor level. Its backrest is on +Z and its open side
// is -Z, which is also the visitor wrapper's forward axis.
export const benchScale = .8;
const loungeBench = {
  size: INTERIOR_PILOT.bench.dimensions_m, top: .635,
  flatFront: -.381, front: -.456, backrestFront: .213
};
export const groundBenchFallback = {
  size: [2.58, 1.3175, .925], top: .65,
  flatFront: -.45, front: -.45, backrestFront: .26
};
export const deckBenchFallback = {
  size: [2.34, 1.09, .785], top: .508,
  flatFront: -.38, front: -.38, backrestFront: .2
};

// The same authored placement drives geometry, collision and interaction.
export function createSeatPlacements(expanded) {
  const placements = [];
  const add = (group, x, z, facing = 1, name = null, floor = 0, accessible = true) => {
    const index = placements.length;
    const id = index === 0 ? 'courtyard-seat' : `bench-seat-${index + 1}`;
    const exit = {x, y:floor, z:z - 1.2 * facing};
    const pose = {facing, angle:facing === 1 ? 0 : Math.PI};
    const clearance = {interactionRadius:1.65, capsuleRadius:.3,
      colliderWidth:group === 'deck' ? (accessible ? 2 : 2.3) : 2.5,
      colliderDepth:group === 'deck' ? .76 : .85};
    placements.push({id, group, name: name || (z > 0 ? `Courtyard bench ${index + 1}` : `${x < 5 ? 'MILI' : 'GOGO'} bench ${index % 2 + 1}`),
      x, z, facing, floor, accessible, exit, pose, clearance});
  };
  if (expanded) {
    for (const lounge of atriumLayout.lounges) for (const [i, point] of lounge.seats.entries())
      add('atrium', point.x, point.z, 1, `${lounge.id === 'west' ? 'West' : 'East'} lounge seat ${i + 1}`);
  } else {
    add('atrium', -7.8, 9.5); add('atrium', 7.8, 9.5);
    add('atrium', -7.8, 13, -1); add('atrium', 7.8, 13, -1);
  }
  for (const store of spatial.stores.filter(store => store.id !== 'newmoon')) {
    const x = storeCenterX(store);
    const seats = expanded && store.id === 'mili' ? miliSeats : [[-3,0,-.8],[3,0,-.8]];
    for (const [dx,,dz] of seats) add(store.id, x + dx, -6 + dz, -1);
  }
  if (expanded) {
    for(const [i,seat] of atriumLayout.upperSeats.entries()){
      add('deck',seat.x,seat.z,seat.facing,`Upper deck bench ${i+1}`,liftLayout.upper);
      placements.at(-1).finish=seat.finish;
    }
  }
  return placements;
}

export function createSeatAnchor(placement, collider, profile = loungeBench, scale = benchScale, footY = placement.floor) {
  const {id, name, x, z, floor, exit, pose, clearance, accessible} = placement;
  const centre = profile.seatCentre ?? (profile.flatFront + profile.backrestFront) / 2;
  const anchor = {x, y:floor + profile.top * scale, z:z + centre * pose.facing};
  const [width, height, depth] = profile.size;
  const bounds = {
    min:{x:x-width/2, y:floor, z:z-depth/2},
    max:{x:x+width/2, y:floor+height*scale, z:z+depth/2}
  };
  return {id, name, x:anchor.x, y:anchor.y, z:anchor.z,
    exitX:exit.x, exitZ:exit.z, floor, facing:pose.facing,
    angle:pose.angle, collider, footY, frontEdge:centre-profile.front,
    anchor, exit, pose, bounds, clearance, accessible};
}

export function isInFrontOfSeat(seat, z) {
  return (z - seat.z) * seat.facing <= -seat.frontEdge;
}
