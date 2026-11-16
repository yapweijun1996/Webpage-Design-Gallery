// Optional, self-contained furniture. Each source primitive is instanced across placements.
import {loadStaticAsset} from './static-asset.js';
import {INTERIOR_PILOT} from './interior-pilot-registry.js';

const sources = Object.freeze(Object.fromEntries(Object.entries(INTERIOR_PILOT).filter(([kind]) => kind !== 'shelf')));

export async function createFurnishings(T, shadows) {
  const records = {};
  await Promise.all(Object.entries(sources).map(async ([kind, definition]) => {
    const record = records[kind] = {status: 'fallback', reason: null, primitives: [], placements: []};
    Object.assign(record, await loadStaticAsset(T, definition, import.meta.url));
  }));
  return {
    place(kind, x, z, height = 1, facing = 1, baseY = 0, yaw = null, shopSlot = null) {
      const record = records[kind];
      const transform = new T.Matrix4().compose(new T.Vector3(x, baseY, z),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw ?? (facing < 0 ? Math.PI : 0)),
        new T.Vector3(1, height, 1));
      record.placements.push({transform, shopSlot});
      return record.status === 'loaded';
    },
    finish(scene,onShopLodMesh=()=>{}) {
      const group = new T.Group();
      group.name = 'Blender furnishings';
      const state = {};
      for (const [kind, record] of Object.entries(records)) {
        const placementsBySlot=new Map();
        for(const placement of record.placements){
          if(!placementsBySlot.has(placement.shopSlot))placementsBySlot.set(placement.shopSlot,[]);
          placementsBySlot.get(placement.shopSlot).push(placement);
        }
        for (const primitive of record.primitives) {
          for(const [shopSlot,placements] of placementsBySlot){
            const mesh = new T.InstancedMesh(primitive.geometry, primitive.material, placements.length);
            mesh.name = `${kind} primitive`;
            placements.forEach((placement, index) => mesh.setMatrixAt(index, new T.Matrix4().multiplyMatrices(placement.transform, primitive.matrix)));
            // Mounted trim uses existing light pools without adding shadow passes.
            mesh.castShadow = shadows && !['wallLight', 'storeSign'].includes(kind); mesh.receiveShadow = true;
            mesh.computeBoundingSphere();
            if(shopSlot===-1)mesh.userData.deckLod=true;
            else if(shopSlot!==null){mesh.userData.shopSlot=shopSlot;onShopLodMesh(mesh);}
            group.add(mesh);
          }
        }
        state[kind] = Object.freeze({assetId: sources[kind].asset_id, identity: sources[kind].sha256, dimensions: sources[kind].dimensions_m, status: record.status, reason: record.reason,
          instances: record.placements.length, primitives: record.primitives.length});
      }
      scene.add(group);
      return Object.freeze(state);
    }
  };
}
