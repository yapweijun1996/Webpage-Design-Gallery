import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mergeStaticGeometries} from './merge-static-geometries.js';

const halfTurn = Math.PI, quarterTurn = Math.PI / 2;
const placements = {
  'hdb-block': [[-10.5, -.2, 70, quarterTurn], [7, -.2, 91, halfTurn]],
  'hdb-void-deck': [[-9, -.12, 54.7, quarterTurn]],
  'road-segment': [53, 63, 73, 83].map(z => [3, -.15, z, 0]),
  'shophouse': [54, 60.4, 66.8, 73.2, 79.6].map(z => [24.6, -.12, z, -quarterTurn]),
  'angsana-tree': [[15.5, 0, 52, .4], [13.4, 0, 59.4, 2.4], [12.8, 0, 79, 1.2], [-3.5, 0, 61, .7], [-3.5, 0, 79, 2.7]]
};

// Only architecture a pedestrian can meet owns a proxy. Keep arcades and
// open void decks passable, including the gaps between actual model columns.
const solidPart = {
  'hdb-block': /^(VOIDDECK_Column|LIFT_Core|STAIR_Core$|GROUND$)/,
  'hdb-void-deck': /^(COLUMN|SERVICE_Core|STAIR_Step|GROUND_Slab)/,
  'road-segment': /^(ROAD_Carriageway|SIDEWALK|KERB)/,
  'shophouse': /^(Arcade_Column|Party_Wall|Rear_Wall|Shopfront|Base$)/,
  'angsana-tree': /^TRUNK$/
};

export async function loadSingaporeStreet(T, signal, {read = fetch, base = new URL('districts/singapore/', import.meta.url)} = {}) {
  const group = new T.Group();
  group.name = 'Singapore neighbourhood street';
  const geometries = new Set(), materials = new Set(), batches = new Map(), boxes = [];
  const models = [], finishes = new Map(), detailDraws = [], sightBounds = [];
  let sceneSightBounds;
  let attached = false;
  const handles = [];
  const loader = new GLTFLoader();
  function discard() {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    geometries.clear();
    materials.clear();
  }
  function addBox(x, y, z, width, height, depth, color, solid = true) {
    const g = new T.BoxGeometry(width, height, depth).translate(x, y, z);
    g.deleteAttribute('uv');
    collect(g, new T.Color(color), .85, 0);
    if (solid) boxes.push({x, y, z, width, height, depth});
  }
  function collect(geometry, color, roughness, metalness, finer = false) {
    const finish = [roughness, metalness].join('/');
    if (!finishes.has(finish)) {
      const material = new T.MeshStandardMaterial({vertexColors:true, roughness, metalness, side:T.DoubleSide});
      materials.add(material);
      finishes.set(finish,material);
    }
    let key = finish, centre;
    if (finer) {
      geometry.computeBoundingSphere();
      const {x,z} = geometry.boundingSphere.center;
      centre = {x:Math.round(x/12)*12,z:Math.round(z/12)*12};
      key += '/' + centre.x + '/' + centre.z;
    }
    if (!batches.has(key)) batches.set(key,{material:finishes.get(finish),parts:[],centre});
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    batches.get(key).parts.push(geometry);
    geometries.add(geometry);
  }
  try {
    const response = await read(new URL('sources.json', base), {signal});
    if (response.status !== 200) throw new Error('Street manifest unavailable');
    const {assets} = await response.json();
    for (const [id, locations] of Object.entries(placements)) {
      signal.throwIfAborted();
      const receipt = assets.find(asset => asset.file === id + '.glb');
      if (!receipt) throw new Error('Street model missing from manifest');
      const response = await read(new URL(receipt.file, base), {signal});
      if (response.status !== 200) throw new Error('Street model unavailable');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== receipt.bytes) throw new Error('Incomplete street model');
      if (globalThis.crypto?.subtle) {
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
        const hex = Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
        if (hex !== receipt.sha256) throw new Error('Street model changed');
      }
      const {scene:source} = await loader.parseAsync(buffer, base.href);
      try {
        for (const [x,y,z,yaw] of locations) {
          signal.throwIfAborted();
          source.position.set(x,y,z);
          source.rotation.y = yaw;
          source.updateMatrixWorld(true);
          source.traverse(node => {
            const authored = node.userData.name;
            const voidDeckCeiling = id === 'hdb-void-deck' && /^TRANSFER_/.test(authored);
            if (voidDeckCeiling || authored && /^(CANOPY_|SLAB_Storey|CONNECT_UpperFloor|Arcade_Canopy|Front_Pitched_Roof|Rear_Pitched_Roof)/.test(authored)) {
              const bounds = new T.Box3().setFromObject(node);
              // The source includes an empty CONNECT_UpperFloor placement marker.
              if (!bounds.isEmpty() && [...bounds.min, ...bounds.max].every(Number.isFinite)) {
                if (voidDeckCeiling) bounds.voidDeckCeiling = true;
                sightBounds.push(bounds);
              }
            }
            if (authored && solidPart[id].test(authored)) {
              const bounds = new T.Box3().setFromObject(node);
              const size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
              if (Math.min(size.x,size.y,size.z) > .005) boxes.push({x:center.x,y:center.y,z:center.z,width:size.x,height:size.y,depth:size.z});
            }
            if (node.isMesh) {
              const {color,roughness,metalness} = node.material;
              const name = node.userData.name || node.parent?.userData.name || '';
              const finer = /^(Shutter_Louvre|DRAIN_Grating|STAIR_CoreSlot|BRANCH)/.test(name);
              collect(node.geometry.clone().applyMatrix4(node.matrixWorld),color,roughness,metalness,finer);
            }
          });
        }
        models.push(id);
      } finally {
        const originalGeometry = new Set(), originalMaterials = new Set();
        source.traverse(node => { if (node.isMesh) { originalGeometry.add(node.geometry); originalMaterials.add(node.material); } });
        for (const g of originalGeometry) g.dispose();
        for (const m of originalMaterials) m.dispose();
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    // The mall foundation ends at z48. Footpaths meet its top at −0.02 m.
    addBox(-8.75,-.13,68,14.5,.22,40,0xc4bdab);
    addBox(19.75,-.13,68,24.5,.22,40,0xd6cdb9);
    addBox(8,-.13,91.1,48,.22,6.2,0xc3baa8);
    addBox(3,-.24,68,9,.18,40,0x575b57);
    // Low masonry edges bound the walkable block and read from both sides.
    addBox(-15.9,.45,71.1,.25,.94,46.2,0x929686);
    addBox(31.9,.45,71.1,.25,.94,46.2,0x929686);
    addBox(8,.45,94.1,48,.94,.25,0x929686);
    for (const {parts,material,centre} of batches.values()) {
      const combined = mergeStaticGeometries(T,parts);
      if (!combined) throw new Error('Incompatible street geometry');
      for (const part of parts) { part.dispose(); geometries.delete(part); }
      geometries.add(combined);
      const draw = new T.Mesh(combined,material);
      draw.receiveShadow = false;
      group.add(draw);
      if (centre) detailDraws.push({draw,centre});
    }
    batches.clear();
    return {
      group, boxes, models,
      update(x,z,tier) {
        const distance = tier === 'low' ? 16 : tier === 'detailed' ? 32 : 24;
        for (const {draw,centre} of detailDraws) draw.visible = Math.hypot(x-centre.x,z-centre.z) <= distance;
      },
      mount(scene, R, physics, cameraBounds) {
        if (attached) return;
        try {
          for (const {x,y,z,width,height,depth} of boxes) handles.push(physics.createCollider(
            R.ColliderDesc.cuboid(width/2,height/2,depth/2).setTranslation(x,y,z)));
          sceneSightBounds = cameraBounds;
          sceneSightBounds?.push(...sightBounds);
          scene.add(group);
          attached = true;
        } catch (error) {
          this.dispose(physics);
          throw error;
        }
      },
      get counts() { return {models:models.length,lodGroups:detailDraws.length,visibleLod:detailDraws.filter(({draw})=>draw.visible).length, geometries:geometries.size, materials:materials.size, colliders:handles.length,cameraBounds:sceneSightBounds ? sightBounds.length : 0}; },
      dispose(physics) {
        group.removeFromParent();
        if (sceneSightBounds) {
          const owned = new Set(sightBounds);
          for (let i=sceneSightBounds.length-1;i>=0;i--) if (owned.has(sceneSightBounds[i])) sceneSightBounds.splice(i,1);
          sceneSightBounds = undefined;
        }
        sightBounds.length = 0;
        for (const handle of handles.splice(0)) physics.removeCollider(handle,false);
        group.clear();
        detailDraws.length = boxes.length = models.length = 0;
        finishes.clear();
        discard();
        attached = false;
      }
    };
  } catch (error) {
    discard();
    throw error;
  }
}
