import {opaqueBatch} from './opaque-batch.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

export const AMENITIES = Object.freeze({
  desk:{file:'mall-service-desk.glb',sha:'228c94a05e5c92c94662ebba6a02863b397a4f0f10768c8ce488b8c322cabcd0',root:'ASSET_MallServiceDesk',bytes:245748,triangles:8024,size:[2.88,1.87,.961],clips:[],placements:[[-12.5,0,5.8,Math.PI]]},
  signs:{file:'mall-wayfinding-ceiling-sign.glb',sha:'dd0db4a794d01dfb25b6cc6f494e7285e9fe42de7a70673a596e848563dc0c14',root:'ASSET_MallWayfindingCeilingSign',bytes:676028,triangles:11524,size:[2.1,.94,.162],clips:[],placements:[[-4.2,6.1,6,0],[6,6.1,6,0]]},
  showcase:{file:'mall-glass-showcase.glb',sha:'782d911730aaa428d684df9695a2be159802ace7ad8be353dadb8d85efcd2179',root:'ASSET_MallGlassShowcase',bytes:96840,triangles:1712,size:[.75,1.8,.532],clips:['DoorOpenClose'],placements:[[-7,0,2.2,0]]},
});
for(const definition of Object.values(AMENITIES)){definition.placements.forEach(Object.freeze);Object.freeze(definition.placements);Object.freeze(definition.size);Object.freeze(definition.clips);Object.freeze(definition);}
export const SHOWCASE_PRODUCTS=Object.freeze(['nz-425g','au-425g','sa-425g','mx-454g'].map((sku,index)=>Object.freeze({id:`new-moon-${sku}-front`,position:Object.freeze([-7+(index===3?.16:index===0?-.16:0),[.479,.919,1.359,.479][index],2.2])})));

const timeout=8000;
function dispose(root){
  const geometry=new Set(),materials=new Set();root?.traverse(mesh=>{if(mesh.geometry)geometry.add(mesh.geometry);if(mesh.material)materials.add(mesh.material);});
  geometry.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());
}
async function load(T,kind,definition){
  const controller=new AbortController();let timer,expired=false,root=null;
  try{
    const task=async()=>{
      const response=await fetch(new URL(definition.file,import.meta.url),{signal:controller.signal});
      if(!response.ok)throw Error('unavailable');const data=await response.arrayBuffer();
      if(data.byteLength!==definition.bytes)throw Error('invalid-size');
      const digest=await crypto.subtle.digest('SHA-256',data);
      if([...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')!==definition.sha)throw Error('hash-mismatch');
      const view=new DataView(data);
      if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error('invalid-container');
      const json=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,view.getUint32(12,true))));
      if(json.images?.length||json.skins?.length||json.extensionsRequired?.length||json.buffers.some(item=>item.uri))throw Error('unsupported-resource');
      if(JSON.stringify((json.animations||[]).map(item=>item.name))!==JSON.stringify(definition.clips))throw Error('invalid-animation');
      const asset=await new GLTFLoader().parseAsync(data,'');root=asset.scene;
      if(expired){dispose(root);root=null;throw Error('timeout');}
      if(!root.getObjectByName(definition.root))throw Error('invalid-root');
      root.updateMatrixWorld(true);const size=new T.Box3().setFromObject(root).getSize(new T.Vector3());
      if([size.x,size.y,size.z].some((value,index)=>Math.abs(value-definition.size[index])>.002))throw Error('invalid-dimensions');
      if(kind==='signs')for(const name of ['FrontText','RearText','FrontIcons','RearIcons','FrontArrows','RearArrows']){
        const part=root.getObjectByName(name);if(!part)throw Error('missing-sign-module');part.removeFromParent();
      }
      // Static closed poses are baked by material, preserving metre scale and reducing draw calls.
      const buckets=new Map();let triangles=0;
      root.traverse(mesh=>{
        if(!mesh.isMesh)return;
        if(mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.morphTargetInfluences?.length)throw Error('unsupported-mesh');
        const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        const flat=geometry.index?geometry.toNonIndexed():geometry;
        if(flat!==geometry)geometry.dispose();
        if(!flat.attributes.normal||!flat.attributes.position)throw Error('missing-attributes');
        triangles+=flat.attributes.position.count/3;
        if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(flat);
      });
      if(triangles>definition.triangles||!buckets.size||buckets.size>8)throw Error('invalid-budget');
      const primitives=[];
      for(const [material,parts] of buckets){
        const geometry=new T.BufferGeometry();
        for(const name of ['position','normal']){
          const length=parts.reduce((sum,part)=>sum+part.attributes[name].array.length,0),array=new Float32Array(length);let offset=0;
          for(const part of parts){array.set(part.attributes[name].array,offset);offset+=part.attributes[name].array.length;}
          geometry.setAttribute(name,new T.BufferAttribute(array,3));
        }
        geometry.computeBoundingSphere();parts.forEach(item=>item.dispose());primitives.push({geometry,material});
      }
      root.traverse(mesh=>mesh.geometry?.dispose());root=null;
      return {status:'loaded',reason:null,primitives,size:[size.x,size.y,size.z]};
    };
    return await Promise.race([task(),new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();reject(Error('timeout'));},timeout);})]);
  }catch(error){dispose(root);return {status:'fallback',reason:error.message,primitives:[],size:definition.size};}
  finally{clearTimeout(timer);}
}
function signTexture(T,x,rear){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const context=canvas.getContext('2d');
  context.fillStyle='#102d26';context.fillRect(0,0,1024,256);context.fillStyle='#f5e8cb';context.font='bold 68px Arial';context.textBaseline='middle';
  const destinations=[['NEW MOON',-10],['MILI',0],['GOGO',10]];
  // Group destinations by direction to keep the authored panel legible at native scale.
  const left=destinations.filter(([,destination])=>(destination<x)!==rear).map(([label])=>label);
  const right=destinations.filter(([,destination])=>(destination<x)===rear).map(([label])=>label);
  context.fillText(`← ${left.join(' · ')}`,40,65,944);
  context.textAlign='right';context.fillText(`${right.join(' · ')} →`,984,191,944);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
export async function addAmenities(T,scene,collider,createCollectProp,shadows,staticProductCount=null,expanded=false){
  const entries=await Promise.all(Object.entries(AMENITIES).map(async([kind,definition])=>[kind,await load(T,kind,definition)]));
  const group=new T.Group();group.name='Mall amenities';const state={},opaque=[];
  for(const [kind,record] of entries){
    const original=AMENITIES[kind];
    const definition=expanded && kind==='desk' ? {...original, placements:[[0,0,9,Math.PI]]} : expanded && kind==='showcase' ? {...original, placements:[[-7,0,7,0]]} : original;
    for(const primitive of record.primitives){
      if(!primitive.material.transparent){
        definition.placements.forEach(([x,y,z,angle])=>{
          const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(1,1,1));
          const geometry=primitive.geometry.clone().applyMatrix4(matrix),count=geometry.attributes.position.count;
          const colour=new Float32Array(count*3),surface=new Float32Array(count*2),material=primitive.material;
          for(let i=0;i<count;i++){colour.set([material.color.r,material.color.g,material.color.b],i*3);surface.set([material.roughness,material.metalness],i*2);}
          geometry.setAttribute('color',new T.BufferAttribute(colour,3));geometry.setAttribute('obSurface',new T.BufferAttribute(surface,2));opaque.push(geometry);
        });primitive.geometry.dispose();primitive.material.dispose();
      }else{
        const mesh=new T.InstancedMesh(primitive.geometry,primitive.material,definition.placements.length);
        definition.placements.forEach(([x,y,z,angle],index)=>mesh.setMatrixAt(index,new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(1,1,1))));
        primitive.material.forceSinglePass=true;mesh.name=`Amenity ${kind} glass`;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
      }
    }
    if(record.status==='fallback'&&kind!=='signs'){
      const [x,,z]=definition.placements[0],size=kind==='desk'?[2.88,1.05,.961]:[.75,1.8,.532];
      const mesh=new T.Mesh(new T.BoxGeometry(...size),new T.MeshStandardMaterial({color:0x21483e,roughness:.7,transparent:kind==='showcase',opacity:kind==='showcase'?.22:1}));
      mesh.position.set(x,size[1]/2,z);mesh.name=`Amenity ${kind} fallback`;group.add(mesh);
    }
    state[kind]=Object.freeze({status:record.status,reason:record.reason,identity:definition.sha,instances:definition.placements.length,primitives:record.primitives.length,dimensions:Object.freeze(record.size),placements:definition.placements,doorPose:kind==='showcase'?'closed':null});
  }
  const opaqueMesh=opaqueBatch(T,opaque,shadows);if(opaqueMesh)group.add(opaqueMesh);
  for(const [x,y,z] of AMENITIES.signs.placements)for(const rear of [false,true]){
    const plane=new T.Mesh(new T.PlaneGeometry(2.04,.44),new T.MeshBasicMaterial({map:signTexture(T,x,rear)}));
    plane.position.set(x,y-.7,z+(rear?-.083:.083));plane.rotation.y=rear?Math.PI:0;plane.name='Actual store directions';group.add(plane);
  }
  if(expanded){collider(0,.94,9,2.88,1.88,.961);collider(-7,.9,7,.75,1.8,.532);}
  else {collider(-12.5,.94,5.8,2.88,1.88,.961);collider(-7,.9,2.2,.75,1.8,.532);}
  let products=staticProductCount??0;
  if(staticProductCount===null)for(const item of SHOWCASE_PRODUCTS){
    const prop=createCollectProp(item.id);if(!prop)continue;prop.position.set(...item.position);group.add(prop);products++;
  }
  scene.add(group);
  return {state:Object.freeze({...state,displayedProducts:products}),interactables:[
    {id:'service-desk',x:expanded?0:-12.5,z:expanded?10.1:6.9,radius:2},
    {id:'wayfinding-west',x:-4.2,z:6,radius:1.7},
    {id:'wayfinding-east',x:6,z:6,radius:1.7},
    {id:'featured-showcase',x:-7,z:expanded?7.9:3.1,radius:1.3},
  ]};
}
