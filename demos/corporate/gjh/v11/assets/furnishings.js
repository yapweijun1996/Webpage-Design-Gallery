// Optional, self-contained furniture. Each source primitive is instanced across placements.
import {GLTFLoader} from '../vendor/GLTFLoader.js';

const sources = Object.freeze({bench: 'gjh-lounge-bench.glb', planter: 'gjh-areca-planter.glb'});
const deadline = 8000;

function validateContainer(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
      view.getUint32(12, true) + 20 > view.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw Error('invalid');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true))));
  // Keep optional furnishings offline and independent of texture or decoder requests.
  if ((json.buffers || []).some(item => item.uri) || (json.images || []).length ||
      (json.extensionsRequired || []).length || (json.animations || []).length || (json.skins || []).length) throw Error('invalid');
}

export async function createFurnishings(T, shadows) {
  const records = {};
  await Promise.all(Object.entries(sources).map(async ([kind, filename]) => {
    const controller = new AbortController();
    let timer;
    const record = records[kind] = {status: 'fallback', reason: null, primitives: [], placements: []};
    try {
      const load = async () => {
        const response = await fetch(new URL(filename, import.meta.url), {signal: controller.signal});
        if (!response.ok) throw Error('unavailable');
        const buffer = await response.arrayBuffer();
        validateContainer(buffer);
        const gltf = await new GLTFLoader().parseAsync(buffer, '');
        gltf.scene.updateMatrixWorld(true);
        const primitives = [];
        gltf.scene.traverse(mesh => {
          if (!mesh.isMesh) return;
          if (mesh.isSkinnedMesh || !mesh.geometry.attributes.position || mesh.morphTargetInfluences?.length ||
              !mesh.matrixWorld.elements.every(Number.isFinite)) throw Error('invalid');
          primitives.push({geometry: mesh.geometry, material: mesh.material, matrix: mesh.matrixWorld.clone()});
        });
        if (!primitives.length || primitives.length > 16) throw Error('invalid');
        return primitives;
      };
      record.primitives = await Promise.race([load(), new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(Error('timeout')); }, deadline);
      })]);
      record.status = 'loaded';
    } catch (error) {
      record.reason = ['timeout', 'invalid', 'unavailable'].includes(error.message) ? error.message : 'unavailable';
    } finally { clearTimeout(timer); }
  }));
  return {
    place(kind, x, z, height = 1, facing = 1) {
      const record = records[kind];
      const transform = new T.Matrix4().compose(new T.Vector3(x, 0, z),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), facing < 0 ? Math.PI : 0),
        new T.Vector3(1, height, 1));
      record.placements.push(transform);
      return record.status === 'loaded';
    },
    finish(scene) {
      const group = new T.Group();
      group.name = 'Blender furnishings';
      const state = {};
      for (const [kind, record] of Object.entries(records)) {
        for (const primitive of record.primitives) {
          const mesh = new T.InstancedMesh(primitive.geometry, primitive.material, record.placements.length);
          mesh.name = `${kind} primitive`;
          record.placements.forEach((placement, index) => mesh.setMatrixAt(index, new T.Matrix4().multiplyMatrices(placement, primitive.matrix)));
          mesh.castShadow = shadows; mesh.receiveShadow = true;
          mesh.computeBoundingSphere(); group.add(mesh);
        }
        state[kind] = Object.freeze({status: record.status, reason: record.reason,
          instances: record.placements.length, primitives: record.primitives.length});
      }
      scene.add(group);
      return Object.freeze(state);
    }
  };
}
