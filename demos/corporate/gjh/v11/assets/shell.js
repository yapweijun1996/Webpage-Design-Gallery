import {loadStaticAsset} from './static-asset.js';
import {opaqueBatch} from './opaque-batch.js';
import {SHELL_LAYOUT, INTERIOR_SHELL} from './interior-shell-registry.js';

// Fixed architectural placements share one opaque PBR batch; physics stays world-owned.
export async function createShell(T) {
  const records = Object.fromEntries(await Promise.all(Object.entries(INTERIOR_SHELL).map(async ([kind, definition]) =>
    [kind, await loadStaticAsset(T, definition, import.meta.url)])));
  return {
    finish(scene, solid) {
      const opaque = [], state = {};
      for (const [kind, record] of Object.entries(records)) {
        const definition = SHELL_LAYOUT.assets[kind];
        for (const [x, y, z, angle] of definition.placements) {
          const placement = new T.Matrix4().compose(new T.Vector3(x, y, z),
            new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), angle), new T.Vector3(1, 1, 1));
          if (record.status === 'loaded') {
            for (const primitive of record.primitives) {
              const matrix = new T.Matrix4().multiplyMatrices(placement, primitive.matrix);
              const geometry = primitive.geometry.clone().applyMatrix4(matrix), count = geometry.attributes.position.count;
              const colour = new Float32Array(count * 3), surface = new Float32Array(count * 2), material = primitive.material;
              for (let i = 0; i < count; i++) {
                colour.set([material.color.r, material.color.g, material.color.b], i * 3);
                surface.set([material.roughness, material.metalness], i * 2);
              }
              geometry.setAttribute('color', new T.BufferAttribute(colour, 3));
              geometry.setAttribute('obSurface', new T.BufferAttribute(surface, 2)); opaque.push(geometry);
            }
          } else {
            for (const component of definition.components) {
              const point = new T.Vector3(...component.position).applyMatrix4(placement);
              solid('box', component.material, point.x, point.y, point.z, ...component.size, angle);
            }
          }
        }
        // The static batch now owns cloned vertex data; release the parsed prototypes.
        const geometries = new Set(), materials = new Set();
        record.primitives.forEach(p => { geometries.add(p.geometry); materials.add(p.material); });
        geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
        state[kind] = Object.freeze({assetId: definition.asset_id, identity: INTERIOR_SHELL[kind].sha256,
          status: record.status, reason: record.reason, instances: definition.placements.length,
          primitives: record.primitives.length, boundsMin: definition.bounds_min, boundsMax: definition.bounds_max});
      }
      const mesh = opaqueBatch(T, opaque, true);
      if (mesh) { mesh.name = 'Native P0 shell'; scene.add(mesh); }
      return Object.freeze(state);
    }
  };
}
