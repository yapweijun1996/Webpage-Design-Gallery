// Registered additions use the native GLB pivot, including wall and ceiling mounts.
import {INTERIOR_ADDITIONS} from './interior-additions-registry.js';
import {loadStaticAsset} from './static-asset.js';
import {batchFurniture} from './opaque-batch.js';
import {createPackedDraw} from './packed-draw.js';
import {createSeatAnchor} from './seat-placements.js';

const nextSlice = () => new Promise(resolve => {
  if (window.requestIdleCallback) window.requestIdleCallback(resolve, {timeout:1500});
  else window.setTimeout(resolve, 32);
});

export function createInteriorAdditions(T, {scene, collider, seats, prepareModel, tier,
  slice = nextSlice}) {
  const state = {}, rows = [], batches = [];
  const axis = new T.Vector3(0,1,0);
  let quality = tier(), loading = false;
  for (const entry of Object.values(INTERIOR_ADDITIONS).filter(entry => entry.placed)) {
    const {xyz, yaw_deg, support} = entry.placement;
    const angle = yaw_deg*Math.PI/180;
    const transform = new T.Matrix4().makeRotationY(angle).setPosition(...xyz);
    const bounds = new T.Box3(new T.Vector3(...entry.bounds_min),new T.Vector3(...entry.bounds_max)).applyMatrix4(transform);
    const centre = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
    const proxy = collider(centre.x,centre.y,centre.z,size.x,size.y,size.z);
    proxy.setEnabled(false);
    const row = {entry,transform,bounds,proxy,status:'pending',slot:/^S\d+$/.test(support) ? Number(support.slice(1)) : null};
    if (entry.kind === 'ottoman') {
      const [x,footY,z] = xyz;
      // Keep this always-available seat solid and visible while its replacement warms.
      const fallback = new T.Mesh(new T.CylinderGeometry(size.x/2,size.x/2,size.y,16),
        new T.MeshStandardMaterial({color:0xdcc8a7}));
      fallback.position.copy(centre);
      scene.add(fallback);
      row.fallback = fallback;
      proxy.setEnabled(true);
      const exit = new T.Vector3(0,0,-1.2).applyAxisAngle(axis,angle).add(new T.Vector3(...xyz));
      seats.push(createSeatAnchor({id:'west-lounge-ottoman',name:'West lounge ottoman',x,z,floor:0,
        exit:{x:exit.x,y:0,z:exit.z},pose:{facing:1,angle},accessible:true,clearance:{interactionRadius:1.65,capsuleRadius:.3}},
        proxy.handle,{size:[size.x,footY+size.y,size.z],top:footY+size.y,front:-size.z/2,seatCentre:0},1,footY));
    }
    rows.push(row);
    state[entry.kind] = {assetId:entry.asset_id,identity:entry.sha256,dimensions:entry.dimensions_m,
      instances:1,get status(){return row.status;},get primitives(){return row.primitives ?? 0;}};
  }

  function enabled(row) { return quality !== 'low' || row.entry.minimum_tier === 'low'; }
  async function warmGroup(group) {
    const parts = [];
    let material;
    for (const row of group) {
      await slice();
      row.status = 'loading';
      const record = await loadStaticAsset(T,row.entry,import.meta.url);
      if (record.status !== 'loaded') { row.status = 'fallback'; continue; }
      row.primitives = record.primitives.length;
      const [merged] = batchFurniture(T,record.primitives);
      if (material) merged.material.dispose();
      else material = merged.material;
      parts.push({row,bounds:row.bounds,geometries:[merged.geometry.applyMatrix4(row.transform)]});
    }
    if (!parts.length) return;
    await slice();
    const packed = createPackedDraw(T,parts,material);
    packed.mesh.name = 'Interior additions / '+group[0].entry.minimum_tier;
    packed.mesh.receiveShadow = true;
    try {
      await prepareModel?.(packed.mesh,{fence:true});
    } catch (error) {
      packed.mesh.geometry.dispose();
      material.dispose();
      throw error;
    }
    packed.mesh.visible = false;
    scene.add(packed.mesh);
    batches.push(packed);
    for (const {row} of parts) {
      row.status = 'loaded';
      row.proxy.setEnabled(enabled(row));
      if (row.fallback) {
        row.fallback.removeFromParent();
        row.fallback.geometry.dispose();
        row.fallback.material.dispose();
      }
    }
  }
  function schedule() {
    if (loading) return;
    const first = rows.find(row => row.status === 'pending' && enabled(row));
    if (!first) return;
    const group = rows.filter(row => row.status === 'pending' && row.entry.minimum_tier === first.entry.minimum_tier);
    loading = true;
    void warmGroup(group).catch(error => {
      for (const row of group) if (row.status !== 'loaded') row.status = 'fallback';
      console.warn('Interior additions warm-up failed',error);
    }).finally(() => { loading = false; schedule(); });
  }
  schedule();
  return {state, update(nextTier, view, shopNear) {
    if (quality !== nextTier) {
      quality = nextTier;
      for (const row of rows) if (row.status === 'loaded') row.proxy.setEnabled(enabled(row));
      schedule();
    }
    for (const batch of batches) {
      batch.update(({row,bounds}) => enabled(row) && !view.deckVisible &&
        (row.slot === null || shopNear.get(row.slot)) && (!view.frustum || view.frustum.intersectsBox(bounds)) ? 0 : -1);
      batch.mesh.visible = batch.mesh.geometry.drawRange.count > 0;
    }
  }};
}
