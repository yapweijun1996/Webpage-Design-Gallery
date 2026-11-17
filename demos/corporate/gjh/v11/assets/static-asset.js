// One strict loader for texture-free static GLBs; callers own placement and fallback.
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {fetchStartupAsset} from './startup-asset-pack.js';

const deadline = 8000;

function validateContainer(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(8, true) !== view.byteLength || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
      view.getUint32(12, true) + 20 > view.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw Error('invalid');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true))));
  // Keep optional furnishings offline and independent of texture or decoder requests.
  if ((json.buffers || []).some(item => item.uri) || (json.images || []).length ||
      (json.extensionsRequired || []).length || (json.animations || []).length || (json.skins || []).length) throw Error('invalid');
}

function disposeScene(scene) {
  const geometries = new Set(), materials = new Set();
  scene?.traverse(mesh => {
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) materials.add(material);
  });
  for (const geometry of geometries) geometry?.dispose();
  for (const material of materials) material?.dispose();
}


export async function loadStaticAsset(T, definition, baseURL) {
    const controller = new AbortController();
    let timer, abandoned = false;
    const record = {status: 'fallback', reason: null, primitives: []};
    try {
      const load = async () => {
        const response = await fetchStartupAsset(new URL(definition.file, baseURL), {signal: controller.signal});
        if (!response.ok) throw Error('unavailable');
        const buffer = await response.arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        if ([...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('') !== definition.sha256) throw Error('invalid');
        validateContainer(buffer);
        const gltf = await new GLTFLoader().parseAsync(buffer, '');
        try {
          if (abandoned) throw Error('timeout');
          const root = gltf.scene.getObjectByName(definition.asset_id);
          const rootExtras = definition.rootExtras ?? {asset_id: definition.asset_id};
          if (!root || Object.entries(rootExtras).some(([key, value]) => root.userData[key] !== value)) throw Error('invalid');
          gltf.scene.updateMatrixWorld(true);
          const bounds = new T.Box3().setFromObject(gltf.scene);
          const size = bounds.getSize(new T.Vector3());
          if ([size.x, size.y, size.z].some((value, i) => Math.abs(value - definition.dimensions_m[i]) > .001)) throw Error('invalid');
          if (definition.bounds_min && [bounds.min.x, bounds.min.y, bounds.min.z].some((value, i) => Math.abs(value - definition.bounds_min[i]) > .001)) throw Error('invalid');
          if (definition.bounds_max && [bounds.max.x, bounds.max.y, bounds.max.z].some((value, i) => Math.abs(value - definition.bounds_max[i]) > .001)) throw Error('invalid');
          const primitives = [];
          gltf.scene.traverse(mesh => {
            if (!mesh.isMesh) return;
            if (mesh.isSkinnedMesh || !mesh.geometry.attributes.position || mesh.morphTargetInfluences?.length ||
                !mesh.matrixWorld.elements.every(Number.isFinite)) throw Error('invalid');
            primitives.push({geometry: mesh.geometry, material: mesh.material, matrix: mesh.matrixWorld.clone()});
          });
          if (!primitives.length || primitives.length > 16) throw Error('invalid');
          return primitives;
        } catch (error) {
          disposeScene(gltf.scene);
          throw error;
        }
      };
      record.primitives = await Promise.race([load(), new Promise((_, reject) => {
        timer = setTimeout(() => { abandoned = true; controller.abort(); reject(Error('timeout')); }, deadline);
      })]);
      record.status = 'loaded';
    } catch (error) {
      record.reason = ['timeout', 'invalid', 'unavailable'].includes(error.message) ? error.message : 'unavailable';
    } finally { clearTimeout(timer); }
    return record;
}
