import {roomAtlas} from './detail-files.js';
import {GLTFLoader, mergeGeometries} from '../shop-sign-vendor.js';

export function mergeInteriorAnchor(T, scene) {
  scene.updateMatrixWorld(true);
  const batches = new Map();
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (!batches.has(mesh.material)) batches.set(mesh.material,[]);
    batches.get(mesh.material).push(mesh);
  });
  const anchor = new T.Group();
  for (const [material,meshes] of batches) {
    const parts = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) {
      // A different primitive format can still use the authored static mesh.
      for (const mesh of meshes) {
        const copy = new T.Mesh(mesh.geometry,material);
        mesh.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);
        anchor.add(copy);
      }
    } else {
      anchor.add(new T.Mesh(geometry,material));
      for (const mesh of meshes) mesh.geometry.dispose();
    }
  }
  if (!anchor.children.length) throw new Error('Empty interior fixture');
  return anchor;
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
  async function load(asset, signal) {
    const buffer = await readMember(assetBase,asset,signal);
    const {scene} = await loader.parseAsync(buffer,new URL('interiors/',assetBase).href);
    if (!asset.roomDetail) return mergeInteriorAnchor(T,scene);
    // Blender already batched each finish. Preserve the stock instance matrices.
    const motion = {scroll:null,pulse:null};
    scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      const m = mesh.material;
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
    });
    scene.userData.roomMotion = motion.scroll || motion.pulse ? motion : null;
    return scene;
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
