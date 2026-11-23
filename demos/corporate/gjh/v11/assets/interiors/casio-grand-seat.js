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

function sameBox(a,b) {
  return a.min.distanceToSquared(b.min)<1e-10 && a.max.distanceToSquared(b.max)<1e-10;
}

export function createGrandBenchMount(T,store,addGuard,registerSeat) {
  const [ax,ay,az]=store.anchor.position_m;
  const localYaw=radians(store.anchor.yaw_deg), c=Math.cos(localYaw),s=Math.sin(localYaw);
  const yaw=radians(store.frame.yaw_world_deg)+localYaw;
  const point=(x,y,z)=>worldInteriorPoint(store,[ax+c*x+s*z,ay+y,az-s*x+c*z]);
  function installGuards(boxes) {
    const removals=[];
    try {
      for(const box of boxes){
        const centre=box.getCenter(new T.Vector3());
        removals.push(addGuard({center:point(...centre),size:box.getSize(new T.Vector3()).toArray(),yaw}));
      }
    } catch(error) {
      removals.forEach(undo=>undo());
      throw error;
    }
    return ()=>removals.forEach(undo=>undo());
  }
  let active,seat,removeSeat,removeGuards;
  return function show(model,pianoHandle,cabinetHandle) {
    const profile=model?.userData.grandPiano, previous=active?.userData.grandPiano;
    if(profile && previous && seat.collider===pianoHandle && seat.cabinetCollider===cabinetHandle &&
        sameBox(profile.bench,previous.bench)) {
      if(!profile.guards.every((box,i)=>sameBox(box,previous.guards[i]))) {
        // Keep the valid occupant while replacing the old LOD's measured solids.
        const releaseNew=installGuards(profile.guards);
        removeGuards();
        removeGuards=releaseNew;
      }
      active=model;
      return;
    }
    removeSeat?.();
    removeGuards?.();
    removeSeat=removeGuards=active=seat=null;
    if(!profile || pianoHandle==null || cabinetHandle==null)return;
    const {bench,guards}=profile;
    const centre=bench.getCenter(new T.Vector3()),size=bench.getSize(new T.Vector3());
    const [x,top,z]=point(centre.x,bench.max.y,centre.z);
    const floor=store.frame.world_origin_m[1]+store.frame.floor_surface_y_m;
    // This diagonal aisle is clear of the audience chair and both original walking proxies.
    const [exitX,,exitZ]=point(centre.x+.90,bench.min.y,centre.z+.85);
    seat=createSeatAnchor({id:'casio-grand-piano-bench',name:'Casio grand piano bench',x,z,floor,
      accessible:true,exit:{x:exitX,y:floor,z:exitZ},
      pose:{facing:1,angle:yaw,approachAngle:Math.atan2(x-exitX,z-exitZ),cameraOffset:-Math.PI/3},
      clearance:{interactionRadius:.7,capsuleRadius:.3,colliderWidth:size.x,colliderDepth:size.z}},
      pianoHandle,{size:size.toArray(),top:top-floor,seatCentre:0,front:-size.z/2},1);
    seat.cabinetCollider=cabinetHandle;
    const mountedSeat=seat;
    seat.modelVisible=()=>{
      const draw=active?.children[active.userData.grandPiano.drawIndex];
      return Boolean(mountedSeat===seat && active?.parent?.visible && active.visible && draw?.visible && draw.material.visible);
    };
    removeGuards=installGuards(guards);
    active=model;
    try { removeSeat=registerSeat(seat); }
    catch(error) { removeGuards();removeGuards=active=seat=null;throw error; }
  };
}
