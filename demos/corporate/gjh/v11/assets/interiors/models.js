import {bakedParts} from './baked-layout.js';
import {roomAtlas} from './detail-files.js';
import {GLTFLoader, mergeGeometries} from '../shop-sign-vendor.js';

function* mergeInteriorAnchor(T, scene) {
  scene.updateMatrixWorld(true);
  const batches = new Map(), anchor = new T.Group();
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (!batches.has(mesh.material)) batches.set(mesh.material,[]);
    batches.get(mesh.material).push(mesh);
  });
  let complete = false;
  try {
    for (const [material,meshes] of batches) {
      const parts = [];
      try {
        for (const mesh of meshes) {
          parts.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
          yield;
        }
        const geometry = mergeGeometries(parts);
        if (geometry) {
          anchor.add(new T.Mesh(geometry,material));
          for (const mesh of meshes) mesh.geometry.dispose();
        } else {
          // Retain the authored transforms for incompatible primitive formats.
          for (const mesh of meshes) {
            const copy = new T.Mesh(mesh.geometry,material);
            mesh.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);
            anchor.add(copy);
          }
        }
      } finally { for (const part of parts) part.dispose(); }
      yield;
    }
    if (!anchor.children.length) throw new Error('Empty interior fixture');
    complete = true;
    return anchor;
  } finally {
    if (!complete) for (const mesh of anchor.children) mesh.geometry.dispose();
  }
}

// Use the same bounded request for a fixture and for the shared print sheet.
async function readMember(assetBase, asset, signal) {
  const url = new URL('interiors/'+asset.file,assetBase);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort',abort,{once:true});
  const timer = setTimeout(abort,8000);
  try {
    const response = await fetch(url,{signal:controller.signal});
    if (!response.ok) throw new Error(`Interior asset request failed: ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== asset.bytes) throw new Error('Interior asset size mismatch');
    return buffer;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort',abort);
  }
}

export function createInteriorModelLoader(T, assetBase, loader = new GLTFLoader()) {
  let atlas;
  const shared = new Map(), lifetime = new AbortController();
  async function loadAtlas() {
    const bytes = await readMember(assetBase,roomAtlas,lifetime.signal);
    const blob = new Blob([bytes],{type:'image/png'});
    let texture;
    if (typeof createImageBitmap === 'function') {
      texture = new T.Texture(await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'}));
    } else {
      const local = URL.createObjectURL(blob);
      try { texture = await new T.TextureLoader().loadAsync(local); } finally { URL.revokeObjectURL(local); }
    }
    texture.flipY = false;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.colorSpace = T.SRGBColorSpace;
    texture.userData.roomAtlas = true;
    texture.needsUpdate = true;
    return texture;
  }
  loader.register(parser => ({
    name:'GJH_room_atlas',
    loadTexture(index) {
      const def = parser.json.textures[index];
      if (parser.json.images[def.source]?.uri !== roomAtlas.file) return null;
      atlas ??= loadAtlas().catch(error => { atlas = undefined; throw error; });
      return atlas;
    }
  }));
  function* prepareDetail(scene, placement) {
    // Blender already batched each finish. Preserve the stock instance matrices.
    const motion = {scroll:null,pulse:null};
    const meshes = [];
    scene.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
    for (const mesh of meshes) {
      const m = mesh.material;
      // Keep the plate and its samples in their shared draw and preserve the shipped GLB.
      if (placement && m.name === placement.material && !mesh.isInstancedMesh) {
        const positions = mesh.geometry.attributes.position;
        const offset = placement.xyz.map((v,k) => v-placement.sourceOrigin[k]);
        for (let i=placement.firstVertex; i<placement.firstVertex+placement.vertexCount; i++) {
          positions.setXYZ(i,positions.getX(i)+offset[0],positions.getY(i)+offset[1],positions.getZ(i)+offset[2]);
        }
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
      }
      if (!lifetime.signal.aborted && (m.name === 'Enamel' || m.name === 'Printed opal')) {
        const reusable = shared.get(m.name);
        if (!reusable) {
          m.userData.roomShared = true;
          shared.set(m.name,m);
        } else if (reusable !== m) {
          mesh.material = reusable;
          m.dispose();
        }
      }
      if (m.name === 'Pulse') motion.pulse = m;
      if (m.name === 'Scroll') {
        motion.scroll = m.map.clone();
        motion.scroll.userData.roomAtlasView = true;
        m.map = m.emissiveMap = motion.scroll;
      }
      yield;
    }
    scene.userData.roomMotion = motion.scroll || motion.pulse ? motion : null;
    return scene;
  }

  async function load(asset, signal, build) {
    const buffer = await readMember(assetBase,asset,signal);
    const {scene} = await loader.parseAsync(buffer,new URL('interiors/',assetBase).href);
    try {
      if (signal?.aborted) throw new DOMException('Interior asset cancelled','AbortError');
      const work = () => asset.roomDetail ? prepareDetail(scene,bakedParts[asset.file]) : mergeInteriorAnchor(T,scene);
      if (build) return await build(work);
      const iterator = work();
      let step;
      do { step = iterator.next(); } while (!step.done);
      return step.value;
    } catch (error) {
      disposeInteriorModel(scene);
      throw error;
    }
  }

  load.dispose = () => {
    lifetime.abort();
    for (const material of shared.values()) material.dispose();
    shared.clear();
    atlas?.then(texture => { texture.dispose(); texture.image?.close?.(); }, () => {});
  };
  return load;
}

export function disposeInteriorModel(model) {
  if (!model) return;
  const materials = new Set(), maps = new Set();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    if (mesh.isInstancedMesh) mesh.dispose();
    if (!mesh.material.userData.roomShared) materials.add(mesh.material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) maps.add(value);
    material.dispose();
  }
  for (const map of maps) {
    if (map.userData.roomAtlasView) map.dispose();
    else if (!map.userData.roomAtlas) {
      map.dispose();
      map.image?.close?.();
    }
  }
}
