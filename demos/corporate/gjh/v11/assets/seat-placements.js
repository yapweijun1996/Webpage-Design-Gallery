import {atriumLayout} from './atrium-layout.js';
import {liftLayout} from './lift-layout.js';
import {spatial, storeCenterX} from './spatial.js';

// The same authored placement drives geometry, collision and interaction.
export function createSeatPlacements(expanded) {
  const placements = [];
  const add = (group, x, z, facing = 1, name = null, floor = 0, accessible = true) => {
    const index = placements.length;
    const id = index === 0 ? 'courtyard-seat' : `bench-seat-${index + 1}`;
    const anchor = {x, y:floor + .015, z:z - .23 * facing};
    const exit = {x, y:floor, z:z - 1.2 * facing};
    const pose = {facing, angle:facing === 1 ? 0 : Math.PI,
      cameraOffset:z < 0 ? (index % 2 === 0 ? -Math.PI / 2 : Math.PI / 2) * facing : .45};
    const clearance = {interactionRadius:1.65, capsuleRadius:.3,
      colliderWidth:group === 'deck' ? (accessible ? 2 : 2.3) : 2.5,
      colliderDepth:group === 'deck' ? .76 : .85};
    placements.push({id, group, name: name || (z > 0 ? `Courtyard bench ${index + 1}` : `${x < 5 ? 'MILI' : 'GOGO'} bench ${index % 2 + 1}`),
      x, z, facing, floor, cameraOffset:pose.cameraOffset, accessible, anchor, exit, pose, clearance});
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
    add(store.id, x - 3, -6.8, -1); add(store.id, x + 3, -6.8, -1);
  }
  if (expanded) {
    add('deck', -6.1, 8.8, 1, 'Upper deck bench 1', liftLayout.upper);
    add('deck', .1, 8.8, 1, 'Upper deck bench 2', liftLayout.upper);
    // Face the clear approach between the bench and shaft guard.
    add('deck', -3, 6, -1, 'Upper deck bench 3', liftLayout.upper);
  }
  return placements;
}

export function createSeatAnchor(placement, collider) {
  const {id, name, floor, anchor, exit, pose, clearance, accessible} = placement;
  return {id, name, x:anchor.x, y:anchor.y, z:anchor.z,
    exitX:exit.x, exitZ:exit.z, floor, facing:pose.facing,
    angle:pose.angle, cameraOffset:pose.cameraOffset, collider,
    anchor, exit, pose, clearance, accessible};
}
