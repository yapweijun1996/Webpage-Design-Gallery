const DISPLAY_DISTANCE = 18;

// The authored slot is the inventory identity. The GPU only needs a dense
// prefix of visible placements, even when the current tier is above Low.
export function createProductDisplayLod(T, meshes, placements) {
  const matrix = new T.Matrix4();
  const batches = meshes.map(mesh => ({mesh, original: mesh.instanceMatrix.array.slice()}));
  const inRange = placements.map(() => true);
  let reserved = -1;

  function sync() {
    for (const {mesh, original} of batches) {
      let count = 0;
      for (let index = 0; index < placements.length; index++) {
        if (inRange[index] && index !== reserved) mesh.setMatrixAt(count++, matrix.fromArray(original, index * 16));
      }
      mesh.count = count;
      if (count) {
        const attribute = mesh.instanceMatrix;
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, count * 16);
        attribute.needsUpdate = true;
      }
      mesh.computeBoundingSphere();
    }
  }

  return {
    update(visitor) {
      let changed = false;
      placements.forEach(({x, z, alwaysVisible}, index) => {
        const visible = Boolean(alwaysVisible) || Math.hypot(visitor.x - x, visitor.z - z) < DISPLAY_DISTANCE;
        if (visible !== inRange[index]) changed = true;
        inRange[index] = visible;
      });
      if (changed) sync();
    },
    setReserved(index) {
      if (index === reserved) return;
      reserved = index;
      sync();
    }
  };
}
