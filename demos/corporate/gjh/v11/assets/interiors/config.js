import {layouts} from './layout.js';

// Runtime download sizes are verified against the provenance manifest in Node.
const fixtureBytes = {
  S01: {low:41552, balanced:97576, detailed:133608},
  S02: {low:38936, balanced:56428},
  S03: {low:57460, balanced:150476},
  S04: {low:26892, balanced:75300, detailed:103268},
  S05: {low:45516, balanced:133736, detailed:145484},
  S06: {low:52960, balanced:111984, detailed:182128},
  S07: {low:42456, balanced:162152},
  S08: {low:60780, balanced:111012},
  S09: {low:22728, balanced:50592},
  S10: {low:49888, balanced:91528, detailed:160204},
  S11: {low:29088, balanced:63544},
  S12: {low:30636, balanced:75168, detailed:91240},
  S13: {low:55696, balanced:163820},
  S14: {low:34300, balanced:53492},
  S15: {low:68504, balanced:186224},
  S16: {low:59820, balanced:107836, detailed:123736},
  S17: {low:28284, balanced:66384, detailed:80676}
};

const solidProps = new Set([
  'photo', 'chest', 'counter', 'dispenser', 'plant', 'easel', 'stand', 'case',
  'rack', 'crate', 'basket', 'drum', 'plinth', 'chair', 'tins', 'pallet',
  'cabinet', 'trolley', 'baffle', 'screen', 'sofa', 'console', 'ottoman', 'keyboard'
]);
export const interiorTiers = ['low', 'balanced', 'detailed'];
export const radians = degrees => degrees * Math.PI / 180;

function collisionFor({position_m, yaw_deg, envelope_whd_m}) {
  const [x,y,z] = position_m, [,h] = envelope_whd_m;
  return {center:[x,y+h/2,z], size:envelope_whd_m, yaw:yaw_deg};
}

export const interiorStores = Object.fromEntries(Object.entries(layouts).map(([id, layout]) => {
  const files = Object.fromEntries(Object.entries(fixtureBytes[id]).map(([tier,bytes]) => [tier,{
    file:`${id.toLowerCase()}-${layout.anchor.asset_id}-${tier}.glb`,tier,bytes
  }]));
  // The two high anchors are suspended over the retained fixtures.
  const colliders = ['S01','S02'].includes(id) ? [] : [collisionFor(layout.anchor)];
  for (const prop of layout.props) {
    const [,,depth] = prop.envelope_whd_m;
    if (!solidProps.has(prop.kind) || prop.position_m[1] > .1 || depth < .1) continue;
    for (const position_m of prop.instance_positions_m ?? [prop.position_m]) {
      colliders.push(collisionFor({...prop, position_m}));
    }
  }
  return [id, {...layout,id,files,colliders}];
}));

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
