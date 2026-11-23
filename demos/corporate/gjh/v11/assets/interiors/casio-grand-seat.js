import {createSeatAnchor} from '../seat-placements.js';
import {radians,worldInteriorPoint} from './config.js';

const guardNames = ['Case_and_action','Keyboard_and_music_rest','Raised_lid'];

// The source node identities disappear when the four meshes share one material batch.
export function measureGrandPiano(T,scene) {
  scene.updateMatrixWorld(true);
  const visible=new Set();
  scene.traverseVisible(node=>{if(node.isMesh && node.material.visible)visible.add(node);});
  const nodes=['Bench',...guardNames].map(name=>scene.getObjectByName(name));
  if(visible.size!==nodes.length || nodes.some(node=>!visible.has(node)||!node.geometry.attributes.position?.count))return null;
  const bounds=nodes.map(node=>new T.Box3().setFromObject(node));
  if(bounds.some(box=>![...box.min,...box.max].every(Number.isFinite) ||
      box.getSize(new T.Vector3()).toArray().some(size=>size<=0)))return null;
  const [bench,...guards]=bounds;
  const centre=bench.getCenter(new T.Vector3());
  // The mounting line stays on +Z of the cushion. Preserve the walking capsule's
  // full radius from every body part even if a later export moves those parts.
  if(guards.some(box=>box.max.z+.30>=centre.z))return null;
  centre.y=bench.max.y+.05;
  const [hit]=new T.Raycaster(centre,new T.Vector3(0,-1,0)).intersectObject(nodes[0]);
  if(!hit || Math.abs(hit.point.y-bench.max.y)>.002)return null;
  return {source:nodes[0],bench,guards};
}

const storefrontLacquer = 'MESH_Black_lacquer';

export function measureStorefrontPiano(T,scene) {
  scene.updateMatrixWorld(true);
  const meshes=[];
  scene.traverseVisible(node=>{if(node.isMesh && node.material.visible && node.material.opacity>0)meshes.push(node);});
  const names=[storefrontLacquer,'MESH_Ivory_keys','MESH_Warm_brass'];
  if(meshes.length!==names.length || names.some(name=>!meshes.some(mesh=>mesh.name===name)))return null;

  // The black batch holds the instrument and the independent four-legged bench.
  // Between them the authored model has an empty strip from z=.578 to z=.812.
  const bench=new T.Box3(), body=new T.Box3();
  const triangle=Array.from({length:3},()=>new T.Vector3());
  for(const mesh of meshes){
    const {attributes:{position},index}=mesh.geometry;
    if(!position?.count)return null;
    const count=index?.count??position.count;
    for(let i=0;i<count;i+=3){
      for(let j=0;j<3;j++)triangle[j].fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);
      const onBench=triangle[0].z>.7;
      if(triangle.some(({x,y,z})=>!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || (z>.7)!==onBench) ||
          (onBench && mesh.name!==storefrontLacquer))return null;
      const box=onBench?bench:body;
      for(const point of triangle)box.expandByPoint(point);
    }
  }
  if(bench.isEmpty() || body.isEmpty())return null;
  const centre=bench.getCenter(new T.Vector3()), size=bench.getSize(new T.Vector3());
  if(size.x<.6 || size.z<.3 || bench.min.y<-.001 || bench.min.y>.02 ||
      bench.max.y<.50 || bench.max.y>.61 || body.max.z+.34>=centre.z ||
      Math.max(Math.abs(body.min.x),Math.abs(body.max.x),Math.abs(bench.min.x),Math.abs(bench.max.x))>.751 ||
      Math.max(Math.abs(body.min.z),Math.abs(bench.max.z))>1.175 || body.min.y<-.001 || body.max.y>1.82)return null;
  const source=meshes.find(mesh=>mesh.name===storefrontLacquer);
  const ray = new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,.06);
  for(const [x,z] of [[0,0],[-.22,-.11],[-.22,.11],[.22,-.11],[.22,.11]]){
    ray.ray.origin.set(centre.x+x,bench.max.y+.04,centre.z+z);
    const [hit]=ray.intersectObject(source);
    if(!hit || Math.abs(hit.point.y-bench.max.y)>.002)return null;
  }
  return {bench,guards:[body]};
}

function sameBox(a,b) {
  return a.min.distanceToSquared(b.min)<1e-10 && a.max.distanceToSquared(b.max)<1e-10;
}

export function createGrandBenchMount(T,store,addGuard,registerSeat) {
  const {position_m:position,yaw_deg:yaw}=store.anchor;
  return createPianoBenchMount(T,store,addGuard,registerSeat,{
    position,localYaw:radians(yaw),id:'casio-grand-piano-bench',name:'Casio grand piano bench',
    // Clear the audience chair and both existing walking proxies.
    standing:(point,centre,bench)=>point(centre.x+.90,bench.min.y,centre.z+.85),
    draw:(model,profile)=>model.children[profile.drawIndex],needsCabinet:true,cameraOffset:-Math.PI/3
  });
}

export function createStorefrontBenchMount(T,store,{position,yaw,scale},addGuard,registerSeat) {
  return createPianoBenchMount(T,store,addGuard,registerSeat,{
    position,localYaw:yaw,scale,id:'casio-storefront-piano-bench',name:'Casio storefront piano bench',
    standing:()=>worldInteriorPoint(store,[-1.02,0,3.35]),
    draw:model=>model.getObjectByName(storefrontLacquer),cameraOffset:-Math.PI/3
  });
}

function createPianoBenchMount(T,store,addGuard,registerSeat,{
  position:[ax,ay,az],localYaw,scale=1,id,name,standing,draw,needsCabinet=false,cameraOffset
}) {
  const c=Math.cos(localYaw),s=Math.sin(localYaw);
  const yaw=radians(store.frame.yaw_world_deg)+localYaw;
  const point=(x,y,z)=>worldInteriorPoint(store,[ax+scale*(c*x+s*z),ay+scale*y,az+scale*(-s*x+c*z)]);
  function installGuards(boxes) {
    const removals=[];
    try {
      for(const box of boxes){
        const centre=box.getCenter(new T.Vector3());
        removals.push(addGuard({center:point(...centre),size:box.getSize(new T.Vector3()).multiplyScalar(scale).toArray(),yaw}));
      }
    } catch(error) {
      removals.forEach(undo=>undo());
      throw error;
    }
    return ()=>removals.forEach(undo=>undo());
  }
  let active,seat,removeSeat,removeGuards;
  return function show(model,pianoHandle,cabinetHandle,profile=model?.userData.grandPiano) {
    const previous=active?.profile;
    if(profile && previous && seat.collider===pianoHandle && seat.cabinetCollider===cabinetHandle &&
        sameBox(profile.bench,previous.bench)) {
      if(profile.guards.length!==previous.guards.length || !profile.guards.every((box,i)=>sameBox(box,previous.guards[i]))) {
        // Keep the valid occupant while replacing the old LOD's measured solids.
        const releaseNew=installGuards(profile.guards);
        removeGuards();
        removeGuards=releaseNew;
      }
      active={model,profile};
      return;
    }
    removeSeat?.();
    removeGuards?.();
    removeSeat=removeGuards=active=seat=null;
    if(!model || !profile || pianoHandle==null || (needsCabinet && cabinetHandle==null))return;
    const {bench,guards}=profile;
    const centre=bench.getCenter(new T.Vector3()),size=bench.getSize(new T.Vector3()).multiplyScalar(scale);
    const [x,top,z]=point(centre.x,bench.max.y,centre.z);
    const floor=store.frame.world_origin_m[1]+store.frame.floor_surface_y_m;
    const [exitX,,exitZ]=standing(point,centre,bench);
    seat=createSeatAnchor({id,name,x,z,floor,
      accessible:true,exit:{x:exitX,y:floor,z:exitZ},
      pose:{facing:1,angle:yaw,approachAngle:Math.atan2(x-exitX,z-exitZ),cameraOffset},
      clearance:{interactionRadius:.7,capsuleRadius:.3,colliderWidth:size.x,colliderDepth:size.z}},
      pianoHandle,{size:size.toArray(),top:top-floor,seatCentre:0,front:-size.z/2},1);
    seat.cabinetCollider=cabinetHandle;
    const mountedSeat=seat;
    seat.modelVisible=()=>{
      if(mountedSeat!==seat || !active?.model.parent?.visible)return false;
      let node=draw(active.model,active.profile);
      if(!node?.material.visible || node.material.opacity<=0)return false;
      while(node && node.visible){
        if(node===active.model)return true;
        node=node.parent;
      }
      return false;
    };
    removeGuards=installGuards(guards);
    active={model,profile};
    try { removeSeat=registerSeat(seat); }
    catch(error) { removeGuards();removeGuards=active=seat=null;throw error; }
  };
}
