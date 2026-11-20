import {disposeVisitorScene,loadVisitorGLTF} from './visitor-gltf.js';

// The shipped player has two geometries. The interval between thresholds
// retains the current level so camera bob cannot repeatedly trigger a swap.
export function projectedVisitorLevel(heightPx, previous) {
  if (heightPx >= 160) return 0;
  if (heightPx <= 64) return 1;
  return previous;
}

/** Both levels share the live skeleton and mixer. V2 keeps its customized material. */
export function createVisitorLOD(T,avatar,{
  url=new URL('./gjh-mall-visitor-v2-lod1.glb',import.meta.url), swapMaterial=false, prepareMaterial, prepareModel, entry
}={}) {
  const parts=[],position=new T.Vector3();
  avatar.traverse(mesh=>{
    if(mesh.isSkinnedMesh)parts.push({mesh,high:mesh.geometry,highMaterial:mesh.material,low:null,lowMaterial:null});
  });
  let loading=null,level=0,failed=false,distance=0,attempts=0,retryAt=0,available=false,disposed=false;
  let lowScene=null, enabled=!entry;
  const upload=new AbortController();
  const matricesMatch=(a,b)=>a.elements.every((value,i)=>Math.abs(value-b.elements[i])<.0001);
  function releaseLow(){
    for(const part of parts){if(!swapMaterial)part.low?.dispose();part.low=null;part.lowMaterial=null;}
    if(lowScene){disposeVisitorScene(lowScene);lowScene=null;}
  }
  async function load(){
    attempts++;
    try{
      const gltf=await loadVisitorGLTF(url);
      if(disposed){disposeVisitorScene(gltf.scene);return;}
      try{
        for(const part of parts){
          const low=gltf.scene.getObjectByName(part.mesh.name);
          if(!low?.isSkinnedMesh)throw Error('LOD component missing');
          const map=low.skeleton.bones.map(b=>part.mesh.skeleton.bones.findIndex(h=>h.name===b.name));
          if(map.some(i=>i<0))throw Error('LOD skeleton mismatch');
          if(swapMaterial && (Array.isArray(low.material) || !low.material.map ||
            map.length!==part.mesh.skeleton.bones.length || !matricesMatch(low.bindMatrix,part.mesh.bindMatrix) ||
            map.some((joint,i)=>!matricesMatch(low.skeleton.boneInverses[i],part.mesh.skeleton.boneInverses[joint])))){
            throw Error('LOD material or bind pose mismatch');
          }
          const geometry=part.low=swapMaterial?low.geometry:low.geometry.clone(),indices=geometry.attributes.skinIndex;
          if (map.some((joint, index) => joint !== index)) {
            for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++)indices.setComponent(i,j,map[indices.getComponent(i,j)]);
          }
          if(swapMaterial){prepareMaterial?.(low.material);part.lowMaterial=low.material;}
        }
        if(swapMaterial)lowScene=gltf.scene;
      }finally{if(!lowScene)disposeVisitorScene(gltf.scene);}
      if(prepareModel){
        const meshes=parts.map(({mesh,low,lowMaterial})=>{
          const proxy=mesh.clone(false);
          proxy.geometry=low;
          if(swapMaterial)proxy.material=lowMaterial;
          return proxy;
        });
        const bindings = swapMaterial ? [...parts.map(part => part.mesh), ...meshes] : meshes;
        await prepareModel(bindings,{signal:upload.signal,alternates:parts.map((part,i)=>[part.mesh,meshes[i]])});
      }
      if(disposed)return;
      available=true;
    }catch{if(!disposed){failed=true;retryAt=performance.now()+30000;}releaseLow();}
  }
  function ensure(){
    if(!enabled||disposed||loading||available||!parts.length||attempts>=2||(failed&&performance.now()<retryAt))return;
    failed=false; loading=load().finally(()=>{loading=null;});
  }
  function schedule() {
    enabled = true;
    if (globalThis.window?.requestIdleCallback) window.requestIdleCallback(ensure,{timeout:1500});
    else setTimeout(ensure,0);
  }
  if (entry) void entry.then(schedule);
  else schedule();
  function switchLevel(next){
    if(next===level)return;
    for(const part of parts){
      part.mesh.geometry=next?part.low:part.high;
      if(swapMaterial)part.mesh.material=next?part.lowMaterial:part.highMaterial;
    }
    level=next;
  }
  return {update(camera, cssHeight){
    if(disposed)return;
    distance=camera.position.distanceTo(avatar.getWorldPosition(position));
    let next = (level === 0 ? distance > 11 : distance > 9) ? 1 : 0;
    if (swapMaterial && cssHeight > 0 && camera.isPerspectiveCamera) {
      // The chase camera faces the player. Measure projected feet and crown
      // in CSS pixels independently of render scale, zoom and camera pitch.
      camera.updateWorldMatrix(true, false);
      const footY = position.project(camera).y;
      avatar.getWorldPosition(position).y += 1.7;
      const heightPx = Math.abs(position.project(camera).y - footY) * cssHeight / 2;
      if (Number.isFinite(heightPx)) next = projectedVisitorLevel(heightPx, level);
    }
    if(next)ensure();
    switchLevel(available ? next : 0);
  },dispose(){disposed=true;upload.abort();switchLevel(0);releaseLow();available=false;},
  get state(){return {level,distance,available,failed};}};
}
