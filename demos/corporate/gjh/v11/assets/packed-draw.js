import {mergeStaticGeometries} from './merge-static-geometries.js';

export function mergeOpaqueMeshes(T, root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), batches = new Map();
  root.traverse(mesh => {
    const m = mesh.material;
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.morphTargetInfluences ||
        !mesh.visible || mesh.geometry.drawRange.start !== 0 || mesh.geometry.drawRange.count !== Infinity ||
        mesh.children.length || !m || Array.isArray(m) || m.transparent || m.transmission || mesh.renderOrder ||
        mesh.layers.mask !== 1 || mesh.castShadow || mesh.receiveShadow || mesh.matrixWorld.determinant() < 0) return;
    if (!batches.has(m)) batches.set(m, []);
    batches.get(m).push(mesh);
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
    const geometry = mergeStaticGeometries(T, parts);
    parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const merged = new T.Mesh(geometry, material);
    merged.name = meshes[0].name;
    meshes.forEach(mesh => mesh.removeFromParent());
    root.add(merged);
  }
}

// One indexed draw can retain a different authored range for each visible
// part. Only indices change during walking; vertex buffers stay immutable.
export function createPackedDraw(T, parts, material, {disposeSources = true} = {}) {
  const sources = parts.flatMap(part => part.geometries);
  for (const geometry of sources) {
    if (!geometry.index) geometry.setIndex(Array.from({length: geometry.attributes.position.count}, (_, i) => i));
  }
  const geometry = mergeStaticGeometries(T, sources);
  const original = geometry.index.array;
  let offset = 0, capacity = 0;
  const ranges = parts.map(part => {
    const variants = part.geometries.map(source => {
      const range = original.subarray(offset, offset + source.index.count);
      offset += range.length;
      return range;
    });
    capacity += Math.max(...variants.map(range => range.length));
    return variants;
  });
  const index = new T.BufferAttribute(new original.constructor(capacity), 1).setUsage(T.DynamicDrawUsage);
  geometry.setIndex(index);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, material);
  const items = parts.map(({geometries, ...part}) => part);
  const active = new Int8Array(items.length).fill(-2);
  const bounds = new T.Box3();
  let count = 0;
  function update(select) {
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      const variant = select(items[i], i);
      if (variant !== active[i]) {
        active[i] = variant;
        changed = true;
      }
    }
    if (!changed) return;
    count = 0;
    bounds.makeEmpty();
    for (let i = 0; i < active.length; i++) {
      if (active[i] < 0) continue;
      const range = ranges[i][active[i]];
      index.array.set(range, count);
      count += range.length;
      bounds.union(items[i].bounds);
    }
    mesh.visible = count > 0;
    geometry.setDrawRange(0, count);
    geometry.boundingBox.copy(bounds);
    bounds.getBoundingSphere(geometry.boundingSphere);
    if (count) {
      index.clearUpdateRanges();
      index.addUpdateRange(0, count);
      index.needsUpdate = true;
    }
  }
  update(() => 0);
  if (disposeSources) for (const source of sources) source.dispose();
  return {mesh, update};
}

// Bounds are authored in world coordinates. A coarse cell is rejected as a
// unit and only cells touching a frustum plane need per-instance tests.
export function boxVisibility(frustum, box) {
  let inside = true;
  for (const {normal, constant} of frustum.planes) {
    const {x, y, z} = normal;
    const loX = x < 0 ? box.max.x : box.min.x, hiX = x < 0 ? box.min.x : box.max.x;
    const loY = y < 0 ? box.max.y : box.min.y, hiY = y < 0 ? box.min.y : box.max.y;
    const loZ = z < 0 ? box.max.z : box.min.z, hiZ = z < 0 ? box.min.z : box.max.z;
    if (x * hiX + y * hiY + z * hiZ + constant < 0) return -1;
    if (x * loX + y * loY + z * loZ + constant < 0) inside = false;
  }
  return inside ? 1 : 0;
}

export function createInstanceVisibility(T, mesh, {colours, slots, attributes = [], cellSize = 3, castShadow = false} = {}) {
  const matrices = mesh.instanceMatrix.array.slice();
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  if (colours) mesh.instanceColor.setUsage(T.DynamicDrawUsage);
  const extras = attributes.map(attribute => ({attribute:attribute.setUsage(T.DynamicDrawUsage), source:attribute.array.slice()}));
  const matrix = new T.Matrix4(), cells = new Map(), boxes = [];
  mesh.geometry.computeBoundingBox();
  for (let i = 0; i < mesh.count; i++) {
    matrix.fromArray(matrices, i * 16);
    const box = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    boxes.push(box);
    const x = Math.floor(matrix.elements[12] / cellSize), y = Math.floor(matrix.elements[13] / cellSize);
    const z = Math.floor(matrix.elements[14] / cellSize), key = x + ',' + y + ',' + z + ',' + slots?.[i];
    if (!cells.has(key)) cells.set(key, {bounds:new T.Box3(), casterBounds:new T.Box3(), parts:[], slot:slots?.[i]});
    const cell = cells.get(key);
    const casterBounds = castShadow ? shadowReceiverBounds(box) : box;
    cell.bounds.union(box);
    cell.casterBounds.union(casterBounds);
    cell.parts.push({box, casterBounds, index:i});
  }
  const bounds = new T.Box3(), selected = new Uint32Array(mesh.count), previous = selected.slice();
  let previousCount = -1;
  mesh.boundingBox ??= new T.Box3();
  mesh.boundingSphere ??= new T.Sphere();
  function syncColours() {
    if (!colours || previousCount <= 0) return;
    for (let i = 0; i < previousCount; i++) mesh.setColorAt(i, colours[previous[i]]);
    uploadPrefix(mesh.instanceColor, previousCount * 3);
  }
  return {
    update(frustum, allow = () => true, shadows = false, occluded) {
      let count = 0, changed = false;
      for (const cell of cells.values()) {
        if (!allow(cell.slot)) continue;
        const bounds = shadows ? cell.casterBounds : cell.bounds;
        const visibility = frustum ? boxVisibility(frustum,bounds) : 1;
        if (visibility < 0 || occluded?.(cell.slot,bounds)) continue;
        for (const {box, casterBounds, index} of cell.parts) {
          if (visibility === 0 && !frustum.intersectsBox(shadows ? casterBounds : box)) continue;
          selected[count] = index;
          if (index !== previous[count]) changed = true;
          count++;
        }
      }
      if (!changed && count === previousCount) return;
      previousCount = count;
      previous.set(selected.subarray(0, count));
      mesh.count = count;
      bounds.makeEmpty();
      for (let i = 0; i < count; i++) {
        matrix.fromArray(matrices, selected[i] * 16);
        mesh.setMatrixAt(i, matrix);
        bounds.union(boxes[selected[i]]);
      }
      mesh.boundingBox.copy(bounds);
      bounds.getBoundingSphere(mesh.boundingSphere);
      if (!count) return;
      uploadPrefix(mesh.instanceMatrix, count * 16);
      for (const {attribute, source} of extras) {
        const {array, itemSize} = attribute;
        for (let i = 0; i < count; i++) {
          const offset = selected[i] * itemSize;
          array.set(source.subarray(offset, offset + itemSize), i * itemSize);
        }
        uploadPrefix(attribute, count * itemSize);
      }
      syncColours();
    },
    refreshColours() {
      if (previousCount < 0) {
        for (let i = 0; i < colours.length; i++) mesh.setColorAt(i, colours[i]);
        mesh.instanceColor.needsUpdate = true;
      } else syncColours();
    }
  };
}

function uploadPrefix(attribute, length) {
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, length);
  attribute.needsUpdate = true;
}

export function boxFrontFaces(eye, centre, size) {
  const x = eye.x - centre.x, y = eye.y - centre.y, z = eye.z - centre.z;
  return (x > size.x/2 ? 1 : x < -size.x/2 ? 2 : 0)
    | (y > size.y/2 ? 4 : y < -size.y/2 ? 8 : 0)
    | (z > size.z/2 ? 16 : z < -size.z/2 ? 32 : 0);
}

// Transparent boxes keep their original exit-then-entry blending. Sort panes
// back to front before ordering the six faces of each convex box.
export function createGlassBatch(T, source, material, panes) {
  const geometry = mergeStaticGeometries(T, panes.map(() => source));
  const position = geometry.attributes.position.setUsage(T.DynamicDrawUsage);
  const index = geometry.index.setUsage(T.DynamicDrawUsage);
  const mesh = new T.Mesh(geometry, material);
  const bounds = new T.Box3(), centre = new T.Vector3(), half = new T.Vector3();
  const original = source.index.array, vertices = source.attributes.position;
  const visible = [], previous = [];
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  function update(view) {
    visible.length = 0;
    let moved = false;
    for (const [i, pane] of panes.entries()) {
      const {position:at, scale} = pane;
      half.copy(scale).multiplyScalar(.5);
      pane.bounds ??= new T.Box3();
      pane.bounds.min.copy(at).sub(half);
      pane.bounds.max.copy(at).add(half);
      if (view && !view.frustum.intersectsBox(pane.bounds)) continue;
      if (!pane.lastPosition?.equals(at)) {
        pane.lastPosition ??= new T.Vector3();
        pane.lastPosition.copy(at);
        for (let vertex = 0; vertex < vertices.count; vertex++) {
          position.setXYZ(i * vertices.count + vertex, at.x + vertices.getX(vertex)*scale.x,
            at.y + vertices.getY(vertex)*scale.y, at.z + vertices.getZ(vertex)*scale.z);
        }
        position.addUpdateRange(i * vertices.count * 3, vertices.count * 3);
        moved = true;
      }
      pane.index = i;
      pane.front = view ? boxFrontFaces(view.eye,at,scale) : 0;
      pane.depth = view ? centre.copy(at).applyMatrix4(view.camera.matrixWorldInverse).z : 0;
      visible.push(pane);
    }
    visible.sort((a,b) => a.depth-b.depth);
    const changed = visible.length*2 !== previous.length ||
      visible.some(({index,front},i) => index !== previous[i*2] || front !== previous[i*2+1]);
    if (changed) {
      let offset = 0;
      previous.length = 0;
      for (const pane of visible) {
        previous.push(pane.index,pane.front);
        const start = pane.index*vertices.count;
        for (const front of [false,true]) for (let face = 0; face < 6; face++) {
          if (Boolean(pane.front & (1 << face)) !== front) continue;
          for (let corner = 0; corner < 6; corner++) index.array[offset++] = start+original[face*6+corner];
        }
      }
      geometry.setDrawRange(0,offset);
      if (offset) {
        index.clearUpdateRanges();
        index.addUpdateRange(0,offset);
        index.needsUpdate = true;
      }
    }
    if (moved) position.needsUpdate = true;
    if (changed || moved) {
      mesh.visible = visible.length > 0;
      bounds.makeEmpty();
      for (const pane of visible) bounds.union(pane.bounds);
      geometry.boundingBox.copy(bounds);
      bounds.getBoundingSphere(geometry.boundingSphere);
    }
  }
  update();
  return {mesh, update};
}

export function shadowReceiverBounds(box) {
  const reach = box.clone(), height = Math.max(0, box.max.y);
  // Project along the fixed key at (-12,16,6) with a margin for PCF.
  reach.min.y = Math.min(-.05, box.min.y);
  reach.max.x += .75 * height;
  reach.min.z -= .375 * height;
  return reach.expandByScalar(.12);
}

export function projectedError(view, sphere, error) {
  const {x, y, z} = sphere.center, matrix = view.camera.matrixWorldInverse.elements;
  const depth = -(matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) - sphere.radius;
  if (depth <= view.camera.near) return Infinity;
  return error * view.pixelScale / depth;
}

export function distantDetail(wasDistant, pixels, threshold = .25) {
  return pixels <= threshold * (wasDistant ? 1.25 : 1);
}

// Keep each placement in one draw at either level of detail. The original
// batch remains mounted until the replacement has passed the sliced uploader.
export function createProjectedBatch(T, mesh, distant, error, colours, slots) {
  const matrix = new T.Matrix4(), parts = [];
  mesh.geometry.computeBoundingBox();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    const geometries = [mesh.geometry, distant].map(source => {
      const geometry = source.clone().applyMatrix4(matrix);
      if (colours) {
        const color = new Float32Array(geometry.attributes.position.count * 3);
        geometry.setAttribute('color', new T.BufferAttribute(color, 3));
      }
      return geometry;
    });
    const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    const casterBounds = mesh.castShadow ? shadowReceiverBounds(bounds) : bounds;
    parts.push({geometries, bounds, casterBounds, slot:slots?.[i],
      casterSphere:mesh.castShadow ? casterBounds.getBoundingSphere(new T.Sphere()) : null,
      sphere:bounds.getBoundingSphere(new T.Sphere()), error:error(matrix), distant:false});
  }
  const material = colours ? mesh.material.clone() : mesh.material;
  if (colours) material.vertexColors = true;
  const vertexCounts = parts.map(({geometries}) => geometries.reduce((sum, g) => sum + g.attributes.position.count, 0));
  const batch = createPackedDraw(T, parts, material);
  batch.mesh.name = mesh.name;
  batch.mesh.castShadow = mesh.castShadow;
  batch.mesh.receiveShadow = mesh.receiveShadow;
  batch.mesh.layers.mask = mesh.layers.mask;
  function refreshColours() {
    if (!colours) return;
    const attribute = batch.mesh.geometry.attributes.color;
    let offset = 0;
    vertexCounts.forEach((count, i) => {
      const {r,g,b} = colours[i];
      for (let j = 0; j < count; j++) attribute.setXYZ(offset++, r, g, b);
    });
    attribute.needsUpdate = true;
  }
  refreshColours();
  return {
    mesh:batch.mesh, refreshColours,
    update(view, allow) {
      batch.update(part => {
        if (allow && !allow(part.slot)) return -1;
        if (!view?.camera) return 0;
        const visible = view.frustum.intersectsBox(part.bounds);
        const shadowVisible = view.shadows && mesh.castShadow && view.frustum.intersectsBox(part.casterBounds);
        if (!visible && !shadowVisible) return -1;
        if (view.shopVisibility?.occluded(part.slot,shadowVisible ? part.casterBounds : part.bounds)) return -1;
        const pixels = shadowVisible
          ? projectedError(view,part.casterSphere,part.error*1.4)
          : projectedError(view,part.sphere,part.error);
        part.distant = !view.focus && distantDetail(part.distant,pixels,.55);
        return Number(part.distant);
      });
    }
  };
}
