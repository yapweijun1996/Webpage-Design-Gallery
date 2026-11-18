import {GLTFLoader} from '../shop-sign-vendor.js';
import manifest from './models/manifest.json' with {type:'json'};

export const moduleIds = Object.freeze(manifest.assets.map(asset => asset.name));
export const modelFiles = Object.freeze(manifest.assets.map(asset => asset.file));

export async function loadModules(assetBase, files=modelFiles, loader=new GLTFLoader()) {
  const modules = new Map(), materials = new Map();
  await Promise.all([...new Set(files)].map(async file => {
    if (!modelFiles.includes(file)) return;
    try {
      const url = new URL('signage/models/'+file, assetBase);
      const response = await fetch(url, {signal:AbortSignal.timeout(5000)});
      if (!response.ok) return;
      const {scene} = await loader.parseAsync(await response.arrayBuffer(), new URL('.',url).href);
      const id = file.slice(0,-4);
      const module = scene.getObjectByName(id);
      if (!module) return;
      module.updateMatrixWorld(true);
      module.traverse(mesh => {
        if (!mesh.isMesh) return;
        const material = mesh.material;
        if (!materials.has(material.name)) materials.set(material.name,material);
        mesh.material = materials.get(material.name);
      });
      modules.set(id,module);
    } catch { /* Each unavailable fitting retains its local procedural socket. */ }
  }));
  return modules;
}
