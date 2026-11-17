import {GLTFLoader} from '../vendor/GLTFLoader.js';
/** Geometry-only LOD shares the original skeleton, mixer and appearance state. */
export function createVisitorLOD(T,avatar) {
  const parts=[];avatar.traverse(n=>{if(n.isSkinnedMesh)parts.push({mesh:n,high:n.geometry,low:null});});
  let loading=null,level=0,failed=false,distance=0,attempts=0,retryAt=0;
  function dispose(scene){scene?.traverse(n=>{n.geometry?.dispose();if(n.material){for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});}
  async function load(){
    const controller=new AbortController(); let timer, abandoned=false;
    attempts++;
    try{
      const source=async()=>{
        const url=new URL('./gjh-mall-visitor-v2-lod1.glb',import.meta.url);
        const response=await fetch(url,{signal:controller.signal});
        if(!response.ok)throw Error('LOD unavailable');
        const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),new URL('.',url).href);
        if(abandoned){dispose(gltf.scene);throw Error('LOD timeout');}
        return gltf;
      };
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{abandoned=true;controller.abort();reject(Error('LOD timeout'));},8000);});
      const gltf=await Promise.race([source(),timeout]);
      try{
        for(const part of parts){
          const low=gltf.scene.getObjectByName(part.mesh.name);
          if(!low?.isSkinnedMesh)throw Error('LOD component missing');
          const geometry=low.geometry.clone(),indices=geometry.attributes.skinIndex;
          const map=low.skeleton.bones.map(b=>part.mesh.skeleton.bones.findIndex(h=>h.name===b.name));
          if(map.some(i=>i<0)){geometry.dispose();throw Error('LOD skeleton mismatch');}
          for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++)indices.setComponent(i,j,map[indices.getComponent(i,j)]);
          part.low=geometry;
        }
      }finally{dispose(gltf.scene);}
      failed=false;
    }catch{failed=true;retryAt=performance.now()+30000;for(const p of parts){p.low?.dispose();p.low=null;}}
    finally{clearTimeout(timer);}
  }
  function ensure(){
    if(loading||parts.every(p=>p.low)||attempts>=2||(failed&&performance.now()<retryAt))return;
    failed=false; loading=load().finally(()=>{loading=null;});
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(ensure,{timeout:1500});
  else setTimeout(ensure,0);
  return {update(camera){
    distance=camera.position.distanceTo(avatar.getWorldPosition(new T.Vector3()));
    if(distance>10)ensure();
    const next=(level===0?distance>11:distance>9)&&parts.every(p=>p.low)?1:0;
    if(next!==level){for(const p of parts)p.mesh.geometry=next?p.low:p.high;level=next;}
  },get state(){return {level,distance,available:parts.every(p=>p.low),failed};}};
}
