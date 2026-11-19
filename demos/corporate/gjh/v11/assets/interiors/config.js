import {layouts} from './layout.js';

export const interiorTiers = ['low', 'balanced', 'detailed'];
export const radians = degrees => degrees * Math.PI / 180;

const shopAccent = {
  S01:0xb84739, S02:0xd4a159, S03:0x79a992, S04:0x785a68, S05:0x913f35,
  S06:0x667887, S07:0x9c4937, S08:0x477aac, S09:0x294f7c, S10:0x478c86,
  S11:0x843e43, S12:0x6f9690, S13:0xa6d7eb, S14:0x665079, S15:0x723f46,
  S16:0x4b9993, S17:0xd99e74
};

export const interiorStores = Object.fromEntries(Object.entries(layouts).map(
  ([id, layout]) => [id, {...layout, id, ambient:{
    kelvin:Math.max(2700,Math.min(4000,layout.accent_kelvin)),
    accent:shopAccent[id],
    focus:layout.lighting // Shop-local metres, including fixture height.
  }}]
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
