// Shop doors translate along a single axis. Test the part of their sweep that
// crosses the opening, excluding the leaves and the permanent shop structure.
export function createDoorwayOccupancy(R, physics, center, halfExtents, leaves) {
  const shape = new R.Cuboid(...halfExtents);
  const rotation = {x: 0, y: 0, z: 0, w: 1};
  const flags = R.QueryFilterFlags.EXCLUDE_FIXED | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const bodies = new Set(leaves.map(leaf => leaf.body.handle));
  const isOccupant = collider => !bodies.has(collider.parent()?.handle);
  return () => Boolean(physics.intersectionWithShape(
    center, rotation, shape, flags, undefined, undefined, undefined, isOccupant
  ));
}
