import {GLTFLoader} from '../vendor/GLTFLoader.js';
/** Geometry-only LOD shares the original skeleton, mixer and appearance state. */
export function createVisitorLOD(T,avatar) {
  const parts=[];avatar.traverse(n=>{if(n.isSkinnedMesh)parts.push({mesh:n,high:n.geometry,low:null});});
  let loading=null,level=0,failed=false,distance=0;
  async function load(){
    try{
      const gltf=await new GLTFLoader().loadAsync(new URL('./gjh-mall-visitor-v2-lod1.glb',import.meta.url).href);
      for(const part of parts){
        const low=gltf.scene.getObjectByName(part.mesh.name);
        if(!low?.isSkinnedMesh)throw Error('LOD component missing');
        const geometry=low.geometry.clone(),indices=geometry.attributes.skinIndex;
        const map=low.skeleton.bones.map(b=>part.mesh.skeleton.bones.findIndex(h=>h.name===b.name));
        if(map.some(i=>i<0))throw Error('LOD skeleton mismatch');
        for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++)indices.setComponent(i,j,map[indices.getComponent(i,j)]);
        part.low=geometry;
      }
      gltf.scene.traverse(n=>{n.geometry?.dispose();if(n.material){for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});
    }catch{failed=true;for(const p of parts){p.low?.dispose();p.low=null;}}
  }
  return {update(camera){
    distance=camera.position.distanceTo(avatar.getWorldPosition(new T.Vector3()));
    if(distance>10&&!loading&&!failed)loading=load();
    const next=(level===0?distance>11:distance>9)&&parts.every(p=>p.low)?1:0;
    if(next!==level){for(const p of parts)p.mesh.geometry=next?p.low:p.high;level=next;}
  },get state(){return {level,distance,available:parts.every(p=>p.low),failed};}};
}
