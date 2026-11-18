const DISPLAY_DISTANCE = 18;

// Share logical placements across material batches. In Low, pack the visible
// instances into the draw prefix. Other tiers retain their fixed instance slots.
export function createProductDisplayLod(T, meshes, placements) {
  const hidden = new T.Matrix4().makeScale(0, 0, 0);
  const matrix = new T.Matrix4();
  const batches = meshes.map(mesh => ({mesh, original: mesh.instanceMatrix.array.slice(), fullBounds: null}));
  const inRange = placements.map(() => true);
  let compact = false, reserved = -1;

  function sync(nextCompact) {
    for (const batch of batches) {
      const {mesh, original} = batch;
      let count = 0;
      for (let index = 0; index < placements.length; index++) {
        const visible = inRange[index] && index !== reserved;
        if (nextCompact && !visible) continue;
        mesh.setMatrixAt(count++, visible ? matrix.fromArray(original, index * 16) : hidden);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (nextCompact) {
        if (!compact) batch.fullBounds = mesh.boundingSphere;
        // Compute into a fresh sphere so the full-layout cache stays intact.
        mesh.boundingSphere = null;
        mesh.computeBoundingSphere();
      } else if (compact) {
        mesh.boundingSphere = batch.fullBounds;
        batch.fullBounds = null;
      }
    }
    compact = nextCompact;
  }

  return {
    update(visitor, tier) {
      const nextCompact = tier === 'low';
      let changed = nextCompact !== compact;
      placements.forEach(({x, z, alwaysVisible}, index) => {
        const visible = Boolean(alwaysVisible) || Math.hypot(visitor.x - x, visitor.z - z) < DISPLAY_DISTANCE;
        if (visible !== inRange[index]) changed = true;
        inRange[index] = visible;
      });
      if (changed) sync(nextCompact);
    },
    setReserved(index) {
      if (index === reserved) return;
      reserved = index;
      sync(compact);
    }
  };
}
