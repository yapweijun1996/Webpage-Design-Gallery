import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {fetchStartupAsset} from './startup-asset-pack.js';
import {INTERIOR_PILOT} from './interior-pilot-registry.js';
import {createCanDisplay, createProductDisplayLod} from './product-display-lod.js';
import {setupArtworkTexture, setupMaterialArtwork} from './artwork-textures.js';
import {decalMaterial} from './surface-decals.js';

// Replaceable candidate configuration; this is not a claim that future generic cans are this SKU set.
export const NEW_MOON_CANS = Object.freeze([
  {sku: 'nz-425g', file: 'new-moon-can-nz-425g-lod1.glb', sha256: 'fcb92b1c62e10338a3295cb56006365da747ad7f25d6b6bec0964d600b742cdb'},
  {sku: 'au-425g', file: 'new-moon-can-au-425g-lod1.glb', sha256: 'd1ae9ff1b35a65c6bb4cafb4a70ff3dd746bf3f70c8ffdac3f93546478feacde'},
  {sku: 'sa-425g', file: 'new-moon-can-sa-425g-lod1.glb', sha256: '7728989f5e4c695c7b4765d219501349898ca1e72f0630bde13c66fc9811e0b5'},
  {sku: 'mx-454g', file: 'new-moon-can-mx-454g-lod1.glb', sha256: '52f8952ca698cc77c6aaf8f1ef5c607a31c401817e6bf6741426e17510164acb'},
]);
const cans = NEW_MOON_CANS;
// Retain the released M056 shelf by default; select all eight pilot assets explicitly.
const interiorPilot = new URLSearchParams(location.search).get('interior') === 'pilot';
const shelf = interiorPilot ? INTERIOR_PILOT.shelf : Object.freeze({file: 'gjh-m056-shelf-lod1.glb', sha256: '949e8278034779c129e3494e614a002d5542108b74e081296acffd8e9d7c6037'});
const canBounds = Object.freeze({x: .0775, y: .12399169057607651, z: .0775});
const shelfBounds = Object.freeze(interiorPilot ? {x: 1.52, y: 1.96, z: .58} : {x: 2.4, y: 2.4, z: .55});
const shelfXs = Object.freeze(interiorPilot ? [-12.85, -10.95, -9.05, -7.15] : [-13.63, -11.21, -8.79, -6.37]);
const shelfTops = Object.freeze(interiorPilot ? [.6825, 1.1925, 1.7025] : [.451, .991, 1.531]);
// V2 stock sits at the front of the shelf so the short humanoid arm can reach it.
const productZ = new URLSearchParams(location.search).get('visitor')==='v1' ? (interiorPilot ? -9.25 : -9.23) : -9.03;
const shelfRotation = interiorPilot ? Math.PI : 0;
const deadline = 8000;

async function sha256(buffer) {
  const bytes = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function inspectContainer(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== view.byteLength || view.getUint32(12, true) + 20 > view.byteLength ||
      view.getUint32(16, true) !== 0x4e4F534A) throw Error('invalid-container');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true))));
  if ((json.buffers || []).some(item => item.uri) || (json.images || []).some(item => item.uri) ||
      (json.extensionsRequired || []).length || (json.animations || []).length || (json.skins || []).length) throw Error('unsupported-external-resource');
}

function disposeAsset(scene) {
  if (!scene) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse(mesh => {
    if (mesh.geometry) geometries.add(mesh.geometry);
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); geometries.forEach(value => value.dispose());
}

async function loadAsset(T, definition, kind, artworkTier) {
  const controller = new AbortController(); let timer; let expired = false; let parsed = null;
  try {
    const operation = async () => {
    const response = await fetchStartupAsset(new URL(definition.file, import.meta.url), {signal: controller.signal});
    if (!response.ok) throw Error('unavailable');
    const buffer = await response.arrayBuffer();
    if (await sha256(buffer) !== definition.sha256) throw Error('hash-mismatch');
    inspectContainer(buffer);
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    parsed = gltf.scene;
    if (expired) { disposeAsset(parsed); parsed = null; throw Error('timeout'); }
    if (definition.asset_id && gltf.scene.getObjectByName(definition.asset_id)?.userData.asset_id !== definition.asset_id) throw Error('invalid-identity');
    gltf.scene.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(gltf.scene), size = box.getSize(new T.Vector3());
    const expected = kind === 'shelf' ? shelfBounds : canBounds;
    if ([size.x, size.y, size.z].some((value, index) => !Number.isFinite(value) || Math.abs(value - expected[['x', 'y', 'z'][index]]) > .0005)) throw Error('invalid-dimensions');
    const primitives = [];
    gltf.scene.traverse(mesh => {
      if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry.attributes.position || !mesh.matrixWorld.elements.every(Number.isFinite)) return;
      if (mesh.morphTargetInfluences?.length) throw Error('invalid-morph-target');
      primitives.push({geometry: mesh.geometry, material: mesh.material, matrix: mesh.matrixWorld.clone()});
    });
    if (!primitives.length || primitives.length > (kind === 'shelf' ? 32 : 8)) throw Error('invalid-primitives');
    if (kind === 'can' && !primitives.some(item => item.material?.map?.image)) throw Error('invalid-label-texture');
      for (const material of new Set(primitives.map(({material}) => material))) setupMaterialArtwork(T,material,artworkTier());
    return {status: 'loaded', reason: null, primitives, size: [size.x, size.y, size.z]};
    };
    return await Promise.race([
      operation(),
      new Promise((_, reject) => { timer = setTimeout(() => { expired = true; controller.abort(); reject(Error('timeout')); }, deadline); }),
    ]);
  } catch (error) { disposeAsset(parsed); parsed = null; return {status: 'fallback', reason: error.message || 'unavailable', primitives: [], size: null}; }
  finally { clearTimeout(timer); }
}

function fallbackCan(T, scene, textures, brass, sku, placements, artworkTier) {
  const profile = [[0, -.485], [.95, -.485], [.98, -.5], [1, -.49], [1, -.465], [.972, -.445], [.972, .445], [1, .465], [1, .49], [.98, .5], [.95, .5], [.95, .475], [0, .475]].map(([r, y]) => new T.Vector2(r, y));
  const body = new T.InstancedMesh(new T.LatheGeometry(profile, 24), brass, placements.length);
  const source = textures.get(`new-moon-${sku}-front.jpg`), canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  for (let column = 0; column < 512; column++) {
    const x0 = 326 + (Math.sin((column / 512 - .5) * Math.PI) + 1) * 174;
    const x1 = 326 + (Math.sin(((column + 1) / 512 - .5) * Math.PI) + 1) * 174;
    context.drawImage(source.image, x0 * source.image.width / 1000, 315 * source.image.height / 1000, (x1 - x0) * source.image.width / 1000, 512 * source.image.height / 1000, column, 0, 1, 512);
  }
  const map = setupArtworkTexture(T,new T.CanvasTexture(canvas),artworkTier());
  const material = decalMaterial(new T.MeshStandardMaterial({map,roughness:.65}));
  const label = new T.InstancedMesh(new T.CylinderGeometry(.974, .974, 512 / 594, 24, 1, true, -Math.PI / 2, Math.PI),material,placements.length);
  const matrix = new T.Matrix4(), scale = new T.Vector3(canBounds.x / 2, canBounds.y, canBounds.z / 2);
  placements.forEach((placement, index) => { matrix.compose(placement.clone().add(new T.Vector3(0, canBounds.y / 2, 0)), new T.Quaternion(), scale); body.setMatrixAt(index, matrix); label.setMatrixAt(index, matrix); });
  body.castShadow = label.castShadow = false;
  body.receiveShadow = label.receiveShadow = true; scene.add(body, label);
  return [body, label];
}

function fallbackShelf(T, scene, displayShelves = []) {
  const instances=12+displayShelves.length*12;
  const mesh = new T.InstancedMesh(new T.BoxGeometry(shelfBounds.x - .08, .04, shelfBounds.z - .05), new T.MeshStandardMaterial({color: 0x6b4931}), instances);
  const matrix = new T.Matrix4(); let index = 0;
  for (const x of shelfXs) for (const y of shelfTops.map(top => top - .02)) { matrix.compose(new T.Vector3(x, y, productZ), new T.Quaternion(), new T.Vector3(1, 1, 1)); mesh.setMatrixAt(index++, matrix); }
  for(const shelf of displayShelves)for(const y of shelfTops.map(top=>top-.02))for(let part=0;part<4;part++){
    const localX=(part-1.5)*(shelfBounds.x-.08)/4, c=Math.cos(shelf.rotation),s=Math.sin(shelf.rotation);
    matrix.compose(new T.Vector3(shelf.x+localX*c,y,shelf.z-localX*s),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),shelf.rotation),new T.Vector3(1,1,1));mesh.setMatrixAt(index++,matrix);
  }
  mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
}


// The native M056 has 29 independently transformed mesh nodes but only five
// materials. Bake each node into shelf-local space and batch by its actual
// material, retaining UVs, textures, emissive surfaces and the shelf instances.
function batchShelf(T, primitives, lightNewMoon) {
  const buckets=new Map();
  for(const primitive of primitives){
    const geometry=primitive.geometry.index?primitive.geometry.toNonIndexed():primitive.geometry.clone();
    geometry.applyMatrix4(primitive.matrix);
    if(!buckets.has(primitive.material))buckets.set(primitive.material,[]);
    buckets.get(primitive.material).push(geometry);
  }
  const result=[];
  for(const [material,parts] of buckets){
    // The imported trim and price rails share planes with the crown, posts
    // and shelf ends. Bias their finish without splitting the material batch.
    if (material.name === 'Champagne gold') decalMaterial(material,-3);
    if (lightNewMoon && material.name === 'Warm wood baked grain') material.color.setRGB(1.35,1.58,1.8);
    if (lightNewMoon && material.name === 'Emerald lacquer') material.color.set('#233d79');
    const geometry=mergeGeometries(parts);
    parts.forEach(part=>part.dispose());
    geometry.computeBoundingSphere();
    result.push({geometry,material,matrix:new T.Matrix4()});
  }
  for(const geometry of new Set(primitives.map(primitive=>primitive.geometry)))geometry.dispose();
  return result;
}

// Shadow depth needs positions only. One geometry retains the shelf's actual
// silhouette without submitting every visible material again to the shadow map.
function shelfShadowGeometry(primitives) {
  const parts = primitives.map(({geometry}) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(part.attributes)) if (name !== 'position') part.deleteAttribute(name);
    return part;
  });
  const merged = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  merged.computeBoundingSphere();
  return merged;
}

export async function addProducts(T, scene, textures, brass,showcase=[],displayShelves=[],heroCan=null,shopSlot,artworkTier=()=> 'low') {
  const displayLods = [];
  let shadowMesh = null, shadowLod = null;
  const lightNewMoon = shopSlot === 1 && !interiorPilot;
  const facingCount = interiorPilot || lightNewMoon ? 11 : 17;
  const spacing = lightNewMoon ? .16 : .10;
  const productOffsets = Array.from({length:facingCount}, (_, index) => (index - (facingCount - 1) / 2) * spacing);
  const reserveIndex = facingCount + Math.floor(facingCount / 2);
  const [shelfRecord, ...canRecords] = await Promise.all([
    loadAsset(T,shelf,'shelf',artworkTier), ...cans.map(item => loadAsset(T,item,'can',artworkTier))
  ]);
  const sourceShelfPrimitives=shelfRecord.primitives.length;
  if(shelfRecord.status==='loaded')shelfRecord.primitives=batchShelf(T,shelfRecord.primitives,lightNewMoon);
  if (shelfRecord.status === 'fallback') fallbackShelf(T, scene, displayShelves);
  else {
    const shadow = {geometry:shelfShadowGeometry(shelfRecord.primitives),
      material:new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide}),
      matrix:new T.Matrix4(), shadowOnly:true};
    const placements = [
      ...shelfXs.map(x => ({x, z: -9.25, rotation: shelfRotation})),
      ...displayShelves,
    ];
    const meshes = [...shelfRecord.primitives, shadow].map(primitive => {
      const mesh = new T.InstancedMesh(primitive.geometry, primitive.material, placements.length);
      if (primitive.shadowOnly) {
        mesh.name = 'Product shelf shadow';
        shadowMesh = mesh;
        // This proxy supplies depth to the shadow map only. A zero instance
        // count during the color pass also avoids a draw-call submission.
        let count;
        mesh.onBeforeRender = () => { count = mesh.count; mesh.count = 0; };
        mesh.onAfterRender = () => { mesh.count = count; };
      }
      placements.forEach(({x, z, rotation}, index) => {
        const matrix = new T.Matrix4().compose(
          new T.Vector3(x, 0, z),
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rotation),
          new T.Vector3(1, 1, 1)
        ).multiply(primitive.matrix);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.castShadow = Boolean(primitive.shadowOnly);
      mesh.receiveShadow = !primitive.shadowOnly;
      scene.add(mesh);
      return mesh;
    });
    for (const placement of placements) placement.bounds = new T.Box3();
    const matrix = new T.Matrix4();
    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox();
      placements.forEach((placement, index) => {
        mesh.getMatrixAt(index, matrix);
        placement.bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix));
      });
    }
    displayLods.push(createProductDisplayLod(T, meshes.filter(mesh => mesh !== shadowMesh), placements, {shopSlot}));
    shadowLod = createProductDisplayLod(T, [shadowMesh], placements, {shadow:true,shopSlot});
  }
  const interactables = [], stock = new Map(), loadedCans = [];
  // The same bounds own collision, focus framing and the projected whole-shelf target.
  const shelves = shelfXs.map((x, index) => Object.freeze({id: `new-moon-${cans[index].sku}-front`,
    pickup: Object.freeze({x:x+.21,z:-9.25+shelfBounds.z/2+.34,radius:1.65}),
    min: Object.freeze({x: x - shelfBounds.x / 2, y: 0, z: -9.25 - shelfBounds.z / 2}),
    max: Object.freeze({x: x + shelfBounds.x / 2, y: shelfBounds.y, z: -9.25 + shelfBounds.z / 2})}));
  canRecords.forEach((record, productIndex) => {
    const sku = cans[productIndex].sku, x = shelfXs[productIndex], placements = [];
    for (const y of shelfTops) for (const dx of productOffsets) placements.push(new T.Vector3(x + dx, y, productZ));
    const shelfPlacements=placements.slice();
    for(const item of showcase.filter(item=>item.id===`new-moon-${sku}-front`))placements.push(new T.Vector3(...item.position));
    const showcaseEnd = placements.length;
    if(heroCan && sku==='nz-425g')placements.push(new T.Vector3(...heroCan));
    const slots = placements.map(({x,y,z}, index) => ({
      x, y, z, alwaysVisible:index >= shelfPlacements.length && index < showcaseEnd,
      bounds:new T.Box3(), visible:true, detail:0
    }));
    if (record.status === 'loaded') {
      if (lightNewMoon) for (const {material} of record.primitives) {
        if (!material.isMeshStandardMaterial || !material.map) continue;
        material.emissive.set(0xffffff);
        material.emissiveMap = material.map;
        material.emissiveIntensity = .12;
      }
      loadedCans.push({primitives:record.primitives, placements:slots});
      stock.set(`new-moon-${sku}-front`, {record, placements:shelfPlacements, slot:slots[reserveIndex]});
    } else {
      const meshes = fallbackCan(T, scene, textures, brass, sku, placements,artworkTier);
      slots.forEach(slot => slot.bounds.setFromCenterAndSize(new T.Vector3(slot.x,slot.y + canBounds.y/2,slot.z),
        new T.Vector3(canBounds.x,canBounds.y,canBounds.z)));
      displayLods.push(createProductDisplayLod(T, meshes, slots, {shopSlot}));
    }
    interactables.push({id: `new-moon-${sku}-front`, x, z: -8.3, radius: 1.9});
  });
  const display = createCanDisplay(T, scene, loadedCans, shopSlot);
  return {displayedProducts:showcase.length,
    updateShopLods(visitor, view) {
      for (const lod of displayLods) lod.update(visitor, view);
      display.update(visitor, view);
      if (shadowMesh?.visible) shadowLod.update(visitor, view);
    },
    setShadows(enabled) { if (shadowMesh) shadowMesh.visible = enabled; }, shelfPositions:shelfXs, shelves, reserveProduct(id) {
    const entry = stock.get(id);
    if (!entry || entry.slot.reserved) return null;
    const index = reserveIndex;
    display.reserve(entry.slot, true);
    const prop = new T.Group(); prop.name='HeldShelfProduct'; prop.position.copy(entry.placements[index]);
    for (const primitive of entry.record.primitives) {const mesh=new T.Mesh(primitive.geometry,primitive.material);mesh.applyMatrix4(primitive.matrix);prop.add(mesh);}
    scene.add(prop); let released=false;
    return {id, prop, centerY:canBounds.y/2, approach:shelves.find(s=>s.id===id).pickup, origin:entry.placements[index].clone(), release() {
      if(released)return; released=true; prop.removeFromParent();
      display.reserve(entry.slot, false);
    }};
  }, createCollectProp(id) {
    const index=cans.findIndex(item => `new-moon-${item.sku}-front`===id), record=canRecords[index];
    if(!record || record.status!=='loaded') return null;
    const group=new T.Group();group.name='SelectedDemoCan';
    for(const primitive of record.primitives){const mesh=new T.Mesh(primitive.geometry,primitive.material);mesh.applyMatrix4(primitive.matrix);group.add(mesh);}
    // Geometry/materials are shared with the shelf: never dispose on gesture completion.
    return group;
  }, interactables, colliders: shelves.map(({min, max}) => ({x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2, sx: max.x - min.x, sy: max.y - min.y, sz: max.z - min.z})), assets: Object.freeze({
    shelf: Object.freeze({model:interiorPilot ? shelf.asset_id : 'GJH-M056', assetId:interiorPilot ? shelf.asset_id : null, lod:1, identity:shelf.sha256, frontAxis:'+Z', status: shelfRecord.status, reason: shelfRecord.reason, instances: 4+displayShelves.length, primitives: sourceShelfPrimitives, dimensions: shelfRecord.size}),
    cans: Object.freeze(Object.fromEntries(canRecords.map((record, index) => {
      const x = shelfXs[index];
      const placements = Object.freeze(shelfTops.flatMap(y => productOffsets.map(dx => Object.freeze({x: x + dx, y, z: productZ}))));
      const dimensions = Object.freeze((record.size || [canBounds.x, canBounds.y, canBounds.z]).slice());
      return [cans[index].sku, Object.freeze({status: record.status, reason: record.reason, identity: cans[index].sha256, instances: shelfTops.length * facingCount, frontFacings: facingCount, reserveIndex, primitives: record.primitives.length, dimensions, actualBounds: dimensions, actualBoundsScale: Object.freeze([dimensions[0] / canBounds.x, dimensions[1] / canBounds.y, dimensions[2] / canBounds.z]), placements, floorY: 0, supportTopY: shelfTops[0], frontAxis: '+Z'})];
    }))),
    totalInstances: cans.length * shelfTops.length * facingCount,showcaseInstances:showcase.length,
    disclosure: (interiorPilot ? 'Original DSP-001 pilot demo furniture; ' : 'Original M056 demo furniture; ') + 'cans use estimated packaging dimensions. Mexico includes a 121-degree unprinted placeholder sector. Unofficial demo, owner-authorized use; independent artwork rights and packaging fidelity are not verified.',
  })};
}
