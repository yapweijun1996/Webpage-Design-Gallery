// An opaque wall can reject a box only when every sightline to that box
// crosses the same solid rectangle. Keep partial and grazing views.
export function createShopVisibility(T) {
  const walls = new Map();
  const overhead = new Map();
  const eye = new T.Vector3();
  const inset = .015;
  let cullOverhead = false;

  function addWall(slot, x, y, z, width, height, depth, lowOnly = false) {
    const blockers = lowOnly ? overhead : walls;
    if (!blockers.has(slot)) blockers.set(slot, []);
    const across = width < depth ? 'x' : 'z';
    const along = across === 'x' ? 'z' : 'x';
    const centre = {x, y, z};
    const halfSpan = (along === 'x' ? width : depth) / 2;
    blockers.get(slot).push({
      across, along, vertical:'y', plane:centre[across],
      left:centre[along]-halfSpan+inset, right:centre[along]+halfSpan-inset,
      bottom:y-height/2+inset, top:y+height/2-inset
    });
  }

  function covers(wall, bounds) {
    const {across, along, vertical, plane, left, right, bottom, top} = wall;
    const start = eye[across], offset = plane-start;
    const near = offset > 0 ? bounds.min[across] : bounds.max[across];
    if (offset > 0 ? near <= plane+inset : near >= plane-inset) return false;
    if (Math.abs(offset) <= inset) return false;
    const a = offset / (bounds.min[across]-start);
    const b = offset / (bounds.max[across]-start);
    const min = (origin,end) => origin + Math.min((end-origin)*a,(end-origin)*b);
    const max = (origin,end) => origin + Math.max((end-origin)*a,(end-origin)*b);
    return min(eye[along],bounds.min[along]) >= left && max(eye[along],bounds.max[along]) <= right &&
      min(eye[vertical],bounds.min[vertical]) >= bottom && max(eye[vertical],bounds.max[vertical]) <= top;
  }

  return {
    addWall,
    addCeiling(slot, x, y, z, width, depth) {
      if (!overhead.has(slot)) overhead.set(slot, []);
      overhead.get(slot).push({across:'y',along:'x',vertical:'z',plane:y,
        left:x-width/2+inset,right:x+width/2-inset,bottom:z-depth/2+inset,top:z+depth/2-inset});
    },
    setOverheadCulling(enabled) { cullOverhead = enabled; },
    setEye(position) { eye.copy(position); },
    occluded(slot, bounds) {
      if (cullOverhead) for (const blocker of overhead.get(slot) ?? []) {
        if ((blocker.across !== 'y' || eye.y > blocker.plane) && covers(blocker,bounds)) return true;
      }
      const room = walls.get(slot);
      if (!room) return false;
      for (const wall of room) if (covers(wall, bounds)) return true;
      return false;
    }
  };
}
