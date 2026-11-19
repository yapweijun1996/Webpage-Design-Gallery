import {layouts} from './layout.js';

export const interiorTiers = ['low', 'balanced', 'detailed'];
export const radians = degrees => degrees * Math.PI / 180;

export const interiorStores = Object.fromEntries(Object.entries(layouts).map(
  ([id, layout]) => [id, {...layout, id}]
));

export function interiorFloorColour(store) {
  const finish = store.floor.colours[0];
  return store.palette[finish]?.hex ?? finish;
}

export function interiorAsset(store, tier) {
  return store.files[tier] ?? (tier === 'detailed' ? store.files.balanced : store.files.low);
}

export function worldInteriorBox(store, box) {
  const [x,y,z] = box.center, [ox,oy,oz] = store.frame.world_origin_m;
  const a = radians(store.frame.yaw_world_deg), c = Math.cos(a), s = Math.sin(a);
  return {center:[ox+x*c+z*s,oy+y,oz-x*s+z*c],size:box.size,yaw:a+radians(box.yaw)};
}

export function interiorRoutes(store) {
  const path = store.frame.walk_path_local_xz_m;
  return [...path.slice(1).map((point,i) => [path[i],point]), ...store.routes];
}

// Interaction tools can inspect an individual shop without adding work to warm-up.
export async function loadInteriorActions(slot) {
  const {actionsBySlot} = await import('./action-layout.js');
  return actionsBySlot[slot] ?? [];
}
