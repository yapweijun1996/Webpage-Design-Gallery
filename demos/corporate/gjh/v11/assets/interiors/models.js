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

// Each attempt reads one size-checked kit member. Textures and material names
// belong to that asset's atlas, so they are shared within its own batch.
export function createInteriorModelLoader(T, assetBase, loader = new GLTFLoader()) {
  return async function load(asset, signal) {
    const url = new URL('interiors/'+asset.file,assetBase);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal.aborted) abort();
    else signal.addEventListener('abort',abort,{once:true});
    const timer = setTimeout(abort,8000);
    let buffer;
    try {
      const response = await fetch(url,{signal:controller.signal});
      if (!response.ok) throw new Error(`Interior fixture request failed: ${response.status}`);
      buffer = await response.arrayBuffer();
      if (buffer.byteLength !== asset.bytes) throw new Error('Interior fixture size mismatch');
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort',abort);
    }
    const {scene} = await loader.parseAsync(buffer,new URL('.',url).href);
    return mergeInteriorAnchor(T,scene);
  };
}

export function disposeInteriorModel(model) {
  if (!model) return;
  const materials = new Set(), maps = new Set();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    materials.add(mesh.material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) maps.add(value);
    material.dispose();
  }
  for (const map of maps) {
    map.dispose();
    map.image?.close?.();
  }
}
