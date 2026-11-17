import {loadStaticAsset} from './static-asset.js';

const sources = Object.freeze({
  bay1m: Object.freeze({asset_id:'ASSET_MallGlass1m',file:'mall-glass-railing-1m.glb',sha256:'556cfc03f38a0cb0c21a125a318c5dc251976e18598f3d15f3e0979dc2dfd49d',dimensions_m:[1.1599999964237213,1.1209999322891235,.1599999964237213],bounds_min:[-.5799999982118607,0,-.07999999821186066],bounds_max:[.5799999982118607,1.1209999322891235,.07999999821186066]}),
  bay: Object.freeze({asset_id:'ASSET_MallGlass2m',file:'mall-glass-railing-2m.glb',sha256:'037b734e7285961e93a75184f7aab28f4a20498fbac5639ed2cd0fab0958c6c5',dimensions_m:[2.1599999964237213,1.1209999322891235,.1599999964237213],bounds_min:[-1.0799999982118607,0,-.07999999821186066],bounds_max:[1.0799999982118607,1.1209999322891235,.07999999821186066]}),
  post: Object.freeze({asset_id:'ASSET_MallGlassPost',file:'mall-glass-railing-post.glb',sha256:'4104d29b95e1e8b82c1e4db8a4e00437aaf60e01c7e8e0b503fcd7c17586dd69',dimensions_m:[.1599999964237213,1.1200000047683716,.1599999964237213],bounds_min:[-.07999999821186066,0,-.07999999821186066],bounds_max:[.07999999821186066,1.1200000047683716,.07999999821186066]}),
});

export async function createDeckRailings(T) {
  const records={};
  const spacing = {bay1m: 1, bay: 2, post: 0};
  await Promise.all(Object.entries(sources).map(async ([kind, definition]) => {
    // The source GLBs identify their root by name and carry metric module metadata.
    const rootExtras = {units: 'metres', origin: 'floor centre', centre_spacing_m: spacing[kind]};
    records[kind] = await loadStaticAsset(T, {...definition, rootExtras}, import.meta.url);
  }));
  const placements={bay1m:[],bay:[],post:[]};
  return {
    place(kind,x,z,yaw=0) {
      if(!records[kind]?.status||records[kind].status!=='loaded')return false;
      placements[kind].push({x,z,yaw});return true;
    },
    finish(scene) {
      for(const [kind,record] of Object.entries(records))for(const primitive of record.primitives){
        const instances=placements[kind];
        if(!instances.length)continue;
        const mesh=new T.InstancedMesh(primitive.geometry,primitive.material,instances.length);
        const position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1),matrix=new T.Matrix4();
        instances.forEach(({x,z,yaw},index)=>{
          position.set(x,7.2,z);rotation.setFromAxisAngle(new T.Vector3(0,1,0),yaw);
          matrix.compose(position,rotation,scale).multiply(primitive.matrix);mesh.setMatrixAt(index,matrix);
        });
        mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.userData.deckLod=true;scene.add(mesh);
      }
      return Object.freeze(Object.fromEntries(Object.entries(records).map(([kind,record])=>[kind,Object.freeze({status:record.status,reason:record.reason,instances:placements[kind].length,primitives:record.primitives.length})])));
    }
  };
}
