import {GLTFLoader} from '../shop-sign-vendor.js';

// Register the local filenames when the corresponding art is delivered. One
// file may contain several named modules. Empty inventory means zero requests.
export const modelFiles = Object.freeze([]);
export const moduleIds = Object.freeze(['sign_frame_corner','sign_frame_edge_h','sign_frame_edge_v',
  'sign_backplate','sign_downlight','sign_blade_bracket']);

// A GLTFLoader mesh can have several primitives represented by child meshes.
// Keep their relative transforms and original material classes together.
export async function loadModules(assetBase,files=modelFiles,loader=new GLTFLoader()) {
  const modules=new Map();
  await Promise.all([...new Set(files)].map(async file=>{
    if(!/^[a-zA-Z0-9_-]+\.glb$/.test(file))return;
    try {
      const url=new URL('signage/models/'+file,assetBase);
      const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
      if(!response.ok)return;
      const {scene}=await loader.parseAsync(await response.arrayBuffer(),url.href.slice(0,url.href.lastIndexOf('/')+1));
      scene.updateMatrixWorld(true);
      scene.traverse(node=>{
        if(moduleIds.includes(node.name)||/^sign_logo3d_[a-z0-9_]+$/.test(node.name))modules.set(node.name,node);
      });
    } catch { /* Missing optional modules retain their procedural counterparts. */ }
  }));
  return modules;
}
