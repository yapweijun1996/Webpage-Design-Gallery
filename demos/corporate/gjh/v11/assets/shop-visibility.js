// An opaque wall can reject a box only when every sightline to that box
// crosses the same solid rectangle. Keep partial and grazing views.
export function createShopVisibility(T) {
  const walls = new Map();
  const eye = new T.Vector3();
  const inset = .015;

  function addWall(slot, x, y, z, width, height, depth) {
    if (!walls.has(slot)) walls.set(slot, []);
    const across = width < depth ? 'x' : 'z';
    const along = across === 'x' ? 'z' : 'x';
    const centre = {x, y, z};
    const halfSpan = (along === 'x' ? width : depth) / 2;
    walls.get(slot).push({
      across, along, plane:centre[across],
      left:centre[along]-halfSpan+inset, right:centre[along]+halfSpan-inset,
      bottom:y-height/2+inset, top:y+height/2-inset
    });
  }

  function covers(wall, bounds) {
    const {across, along, plane, left, right, bottom, top} = wall;
    const start = eye[across], offset = plane-start;
    const near = offset > 0 ? bounds.min[across] : bounds.max[across];
    if (offset > 0 ? near <= plane+inset : near >= plane-inset) return false;
    if (Math.abs(offset) <= inset) return false;
    const a = offset / (bounds.min[across]-start);
    const b = offset / (bounds.max[across]-start);
    const min = (origin,end) => origin + Math.min((end-origin)*a,(end-origin)*b);
    const max = (origin,end) => origin + Math.max((end-origin)*a,(end-origin)*b);
    return min(eye[along],bounds.min[along]) >= left && max(eye[along],bounds.max[along]) <= right &&
      min(eye.y,bounds.min.y) >= bottom && max(eye.y,bounds.max.y) <= top;
  }

  return {
    addWall,
    setEye(position) { eye.copy(position); },
    occluded(slot, bounds) {
      const room = walls.get(slot);
      if (!room) return false;
      for (const wall of room) if (covers(wall, bounds)) return true;
      return false;
    }
  };
}
