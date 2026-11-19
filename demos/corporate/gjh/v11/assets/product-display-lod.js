import {mergeStaticGeometries} from './merge-static-geometries.js';
import {createPackedDraw, shadowReceiverBounds} from './packed-draw.js';

const DISPLAY_DISTANCE = 18;

// At balcony distance an individual tin is a few screen pixels tall. Keep the
// display furniture and labels, and restore stock on the ground-floor view.
function balconyCanVisible(view, bounds) {
  if (!view?.low || !view.deckVisible) return true;
  return (bounds.max.y-bounds.min.y)*view.pixelScale >= 8*bounds.distanceToPoint(view.eye);
}

// The authored slot is the inventory identity. The GPU only needs a dense
// prefix of visible placements, even when the current tier is above Low.
export function createProductDisplayLod(T, meshes, placements, {shadow = false, shopSlot} = {}) {
  const matrix = new T.Matrix4();
  const batches = meshes.map(mesh => ({mesh, original: mesh.instanceMatrix.array.slice()}));
  const inRange = placements.map(() => true);
  const bounds = placements.map(placement => shadow ? shadowReceiverBounds(placement.bounds) : placement.bounds);
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
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }

  return {
    update(visitor, view) {
      let changed = false;
      placements.forEach(({x, z, alwaysVisible}, index) => {
        const visible = (alwaysVisible || Math.hypot(visitor.x - x, visitor.y ?? 0, visitor.z - z) < DISPLAY_DISTANCE) &&
          (!view || (view.frustum.intersectsBox(bounds[index]) &&
            (!placements[index].smallStock || balconyCanVisible(view,bounds[index])) &&
            (alwaysVisible || !view.shopVisibility?.occluded(shopSlot, bounds[index]))));
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

// The textured sleeve, metal rim and lid all keep their original materials.
// The mid-distance variant retains the authored rim and trades the subpixel
// stamped details for a plain lid. The far sleeve keeps the original UV seam.
export function makeCanLods(T, {geometry, material}) {
  const position = geometry.attributes.position;
  if (material.map) {
    const outer = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) outer[i] = Math.hypot(position.getX(i), position.getZ(i));
    const radius = Math.max(...outer);
    const indices = geometry.index.array;
    const sleeve = geometry.clone(), index = [];
    for (let i = 0; i < indices.length; i += 3) {
      if (outer[indices[i]] >= radius - .00001 && outer[indices[i+1]] >= radius - .00001 &&
          outer[indices[i+2]] >= radius - .00001) index.push(indices[i], indices[i+1], indices[i+2]);
    }
    sleeve.setIndex(index);
    return [geometry, geometry, sleeve];
  }
  const lathe = (profile, segments) => {
    const result = new T.LatheGeometry(profile.map(([r,y]) => new T.Vector2(r,y)), segments);
    result.deleteAttribute('uv');
    return result;
  };
  if (material.name === 'Gold lacquered rim') {
    const bottom = lathe([[.03370,0],[.03735,0],[.03875,.00275],[.03775,.0045]],18);
    const top = lathe([[.03775,.1190],[.03875,.12084],[.03735,.12359],[.03370,.12359]],18);
    const rims = mergeStaticGeometries(T, [bottom, top]);
    bottom.dispose(); top.dispose();
    return [geometry, geometry, rims];
  }
  const lid = lathe([[0,.0022],[.026,.003],[.03255,0],[.03376,0],
    [.03376,.12359],[.03087,.12229],[.02866,.12079],[0,.12079]],36);
  const cap = new T.CylinderGeometry(.0338,.0338,.12359,18).translate(0,.12359/2,0);
  cap.deleteAttribute('uv');
  return [geometry, lid, cap];
}

export function canDetail(previous, distance, focus = false) {
  if (focus || distance < (previous === 0 ? 3.5 : 3.1)) return 0;
  if (distance < (previous === 2 ? 5.6 : 6.4)) return 1;
  return 2;
}

export function createCanDisplay(T, scene, records, shopSlot) {
  const slots = [];
  const buckets = new Map();
  const point = new T.Vector3();
  for (const {primitives, placements} of records) {
    slots.push(...placements);
    for (const primitive of primitives) {
      const {material} = primitive;
      // The four pinned SKUs use the same untextured gold/silver finishes.
      const key = material.map ? material : material.name;
      if (!buckets.has(key)) buckets.set(key, {material, parts:[]});
      const variants = makeCanLods(T, primitive);
      primitive.geometry.computeBoundingBox();
      const sources = [...new Set(variants)], levels = variants.map(source => sources.indexOf(source));
      for (const slot of placements) {
        const matrix = new T.Matrix4().makeTranslation(slot.x, slot.y, slot.z).multiply(primitive.matrix);
        const unique = sources.map(source => source.clone().applyMatrix4(matrix));
        const bounds = primitive.geometry.boundingBox.clone().applyMatrix4(matrix);
        slot.bounds.union(bounds);
        buckets.get(key).parts.push({geometries:unique, levels, bounds, slot});
      }
      for (const geometry of new Set(variants)) if (geometry !== primitive.geometry) geometry.dispose();
    }
  }
  const batches = [...buckets.values()].map(({material, parts}) => {
    const batch = createPackedDraw(T, parts, material);
    batch.mesh.name = 'New Moon canned products';
    batch.mesh.receiveShadow = true;
    scene.add(batch.mesh);
    return batch;
  });
  function sync() {
    for (const {update} of batches) update(({levels, slot}) =>
      slot.visible && !slot.reserved ? levels[slot.detail] : -1);
  }
  return {
    update(visitor, view) {
      for (const slot of slots) {
        const {x, y, z, alwaysVisible, bounds} = slot;
        slot.visible = (alwaysVisible || Math.hypot(visitor.x-x, (visitor.y ?? y)-y, visitor.z-z) < DISPLAY_DISTANCE)
          && (!view || (view.frustum.intersectsBox(bounds) &&
            balconyCanVisible(view,bounds) &&
            (alwaysVisible || !view.shopVisibility?.occluded(shopSlot,bounds))));
        if (slot.visible) {
          const distance = view ? view.eye.distanceTo(point.set(x,y,z)) : Math.hypot(visitor.x-x,visitor.z-z);
          slot.detail = canDetail(slot.detail, distance, view?.focus);
        }
      }
      sync();
    },
    reserve(slot, reserved) {
      slot.reserved = reserved;
      sync();
    }
  };
}
