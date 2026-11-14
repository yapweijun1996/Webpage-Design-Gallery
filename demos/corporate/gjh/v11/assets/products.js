import {GLTFLoader} from '../vendor/GLTFLoader.js';

// Replaceable candidate configuration; this is not a claim that future generic cans are this SKU set.
export const NEW_MOON_CANS = Object.freeze([
  {sku: 'nz-425g', file: 'new-moon-can-nz-425g-lod1.glb', sha256: 'fcb92b1c62e10338a3295cb56006365da747ad7f25d6b6bec0964d600b742cdb'},
  {sku: 'au-425g', file: 'new-moon-can-au-425g-lod1.glb', sha256: 'd1ae9ff1b35a65c6bb4cafb4a70ff3dd746bf3f70c8ffdac3f93546478feacde'},
  {sku: 'sa-425g', file: 'new-moon-can-sa-425g-lod1.glb', sha256: '7728989f5e4c695c7b4765d219501349898ca1e72f0630bde13c66fc9811e0b5'},
  {sku: 'mx-454g', file: 'new-moon-can-mx-454g-lod1.glb', sha256: '52f8952ca698cc77c6aaf8f1ef5c607a31c401817e6bf6741426e17510164acb'},
]);
const cans = NEW_MOON_CANS;
const shelf = Object.freeze({file: 'mall-display-shelf.glb', sha256: '9538cc7b954a1510397e4f1dffc47bbed6c99f7460edfb1e55ef4dc28561966d'});
const canBounds = Object.freeze({x: .0775, y: .12399169057607651, z: .0775});
const shelfBounds = Object.freeze({x: 1.5200000405311584, y: 1.9600000381469727, z: .5799999535083771});
const shelfXs = Object.freeze([-12.85, -10.95, -9.05, -7.15]);
const shelfTops = Object.freeze([.6825, 1.1925, 1.7025]);
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

async function loadAsset(T, definition, kind) {
  const controller = new AbortController(); let timer; let expired = false; let parsed = null;
  try {
    const operation = async () => {
    const response = await fetch(new URL(definition.file, import.meta.url), {signal: controller.signal});
    if (!response.ok) throw Error('unavailable');
    const buffer = await response.arrayBuffer();
    if (await sha256(buffer) !== definition.sha256) throw Error('hash-mismatch');
    inspectContainer(buffer);
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    parsed = gltf.scene;
    if (expired) { disposeAsset(parsed); parsed = null; throw Error('timeout'); }
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
    if (!primitives.length || primitives.length > 8) throw Error('invalid-primitives');
    if (kind === 'can' && !primitives.some(item => item.material?.map?.image)) throw Error('invalid-label-texture');
    return {status: 'loaded', reason: null, primitives, size: [size.x, size.y, size.z]};
    };
    return await Promise.race([
      operation(),
      new Promise((_, reject) => { timer = setTimeout(() => { expired = true; controller.abort(); reject(Error('timeout')); }, deadline); }),
    ]);
  } catch (error) { disposeAsset(parsed); parsed = null; return {status: 'fallback', reason: error.message || 'unavailable', primitives: [], size: null}; }
  finally { clearTimeout(timer); }
}

function fallbackCan(T, scene, textures, brass, sku, placements) {
  const profile = [[0, -.485], [.95, -.485], [.98, -.5], [1, -.49], [1, -.465], [.972, -.445], [.972, .445], [1, .465], [1, .49], [.98, .5], [.95, .5], [.95, .475], [0, .475]].map(([r, y]) => new T.Vector2(r, y));
  const body = new T.InstancedMesh(new T.LatheGeometry(profile, 24), brass, placements.length);
  const source = textures.get(`new-moon-${sku}-front.jpg`), canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  for (let column = 0; column < 512; column++) {
    const x0 = 326 + (Math.sin((column / 512 - .5) * Math.PI) + 1) * 174;
    const x1 = 326 + (Math.sin(((column + 1) / 512 - .5) * Math.PI) + 1) * 174;
    context.drawImage(source.image, x0 * source.image.width / 1000, 315 * source.image.height / 1000, (x1 - x0) * source.image.width / 1000, 512 * source.image.height / 1000, column, 0, 1, 512);
  }
  const label = new T.InstancedMesh(new T.CylinderGeometry(.974, .974, 512 / 594, 24, 1, true, -Math.PI / 2, Math.PI), new T.MeshStandardMaterial({map: new T.CanvasTexture(canvas), roughness: .65}), placements.length);
  const matrix = new T.Matrix4(), scale = new T.Vector3(canBounds.x / 2, canBounds.y, canBounds.z / 2);
  placements.forEach((placement, index) => { matrix.compose(placement.clone().add(new T.Vector3(0, canBounds.y / 2, 0)), new T.Quaternion(), scale); body.setMatrixAt(index, matrix); label.setMatrixAt(index, matrix); });
  body.castShadow = body.receiveShadow = label.castShadow = label.receiveShadow = true; scene.add(body, label);
}

function fallbackShelf(T, scene) {
  const mesh = new T.InstancedMesh(new T.BoxGeometry(1.5, .065, .57), new T.MeshStandardMaterial({color: 0x6b4931}), 16);
  const matrix = new T.Matrix4(); let index = 0;
  for (const x of shelfXs) for (const y of [.14, .65, 1.16, 1.67]) { matrix.compose(new T.Vector3(x, y, -9.25), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI), new T.Vector3(1, 1, 1)); mesh.setMatrixAt(index++, matrix); }
  mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
}

export async function addProducts(T, scene, textures, brass) {
  const [shelfRecord, ...canRecords] = await Promise.all([loadAsset(T, shelf, 'shelf'), ...cans.map(item => loadAsset(T, item, 'can'))]);
  if (shelfRecord.status === 'fallback') fallbackShelf(T, scene);
  else for (const primitive of shelfRecord.primitives) {
    const mesh = new T.InstancedMesh(primitive.geometry, primitive.material, shelfXs.length);
    shelfXs.forEach((x, index) => { const matrix = new T.Matrix4(); matrix.compose(new T.Vector3(x, 0, -9.25), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI), new T.Vector3(1, 1, 1)); mesh.setMatrixAt(index, new T.Matrix4().multiplyMatrices(matrix, primitive.matrix)); });
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  }
  const interactables = [];
  canRecords.forEach((record, productIndex) => {
    const sku = cans[productIndex].sku, x = shelfXs[productIndex], placements = [];
    for (const y of shelfTops) for (const dx of [-.44, 0, .44]) placements.push(new T.Vector3(x + dx, y, -9.25));
    if (record.status === 'loaded') for (const primitive of record.primitives) {
      const mesh = new T.InstancedMesh(primitive.geometry, primitive.material, placements.length);
      placements.forEach((position, index) => { const matrix = new T.Matrix4(); matrix.compose(position, new T.Quaternion(), new T.Vector3(1, 1, 1)); mesh.setMatrixAt(index, new T.Matrix4().multiplyMatrices(matrix, primitive.matrix)); });
      mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    } else fallbackCan(T, scene, textures, brass, sku, placements);
    interactables.push({id: `new-moon-${sku}-front`, x, z: -8.3, radius: 1.9});
  });
  return {createCollectProp(id) {
    const index=cans.findIndex(item => `new-moon-${item.sku}-front`===id), record=canRecords[index];
    if(!record || record.status!=='loaded') return null;
    const group=new T.Group();group.name='SelectedDemoCan';
    for(const primitive of record.primitives){const mesh=new T.Mesh(primitive.geometry,primitive.material);mesh.applyMatrix4(primitive.matrix);group.add(mesh);}
    // Geometry/materials are shared with the shelf: never dispose on gesture completion.
    return group;
  }, interactables, colliders: shelfXs.map(x => ({x, y: shelfBounds.y / 2, z: -9.25, sx: shelfBounds.x, sy: shelfBounds.y, sz: shelfBounds.z})), assets: Object.freeze({
    shelf: Object.freeze({status: shelfRecord.status, reason: shelfRecord.reason, instances: 4, primitives: shelfRecord.primitives.length, dimensions: shelfRecord.size}),
    cans: Object.freeze(Object.fromEntries(canRecords.map((record, index) => {
      const x = shelfXs[index];
      const placements = Object.freeze(shelfTops.flatMap(y => [-.44, 0, .44].map(dx => Object.freeze({x: x + dx, y, z: -9.25}))));
      const dimensions = Object.freeze((record.size || [canBounds.x, canBounds.y, canBounds.z]).slice());
      return [cans[index].sku, Object.freeze({status: record.status, reason: record.reason, identity: cans[index].sha256, instances: 9, primitives: record.primitives.length, dimensions, actualBounds: dimensions, actualBoundsScale: Object.freeze([dimensions[0] / canBounds.x, dimensions[1] / canBounds.y, dimensions[2] / canBounds.z]), placements, floorY: 0, supportTopY: shelfTops[0], frontAxis: '+Z'})];
    }))),
    totalInstances: 36,
    disclosure: 'Shelf panels and can dimensions are estimated from reviewed GLBs; Mexico includes a 121-degree unprinted placeholder sector. Unofficial demo, owner-authorized use; independent artwork rights and packaging fidelity are not verified.',
  })};
}
