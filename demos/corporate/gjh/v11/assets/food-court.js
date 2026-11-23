import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mergeStaticGeometries} from './merge-static-geometries.js';
import {createSeatAnchor} from './seat-placements.js';
import {districtManifest, districtModel, disposeDistrictSource} from './district-assets.js';

const floor = -.02, table = {x:27.1,z:86.8};
const sources = [
  ['hawker-stall',21,floor,91.9,Math.PI],
  ['chicken-rice-stall',26.2,floor,91.9,Math.PI],
  ['restaurant-table-chair-set',table.x,floor,table.z,0],
  ['kopitiam-kettle',20.6,floor+.93,90.86,Math.PI]
];

function diningSeat(bounds, handle, visible) {
  const dx=bounds.x-table.x, dz=bounds.z-table.z, length=Math.hypot(dx,dz);
  const outward={x:dx/length,z:dz/length};
  const side=Math.abs(dx)>Math.abs(dz) ? (dx>0 ? 'east' : 'west') : (dz>0 ? 'south' : 'north');
  const angle=Math.atan2(outward.x,outward.z), pose={angle,approachAngle:angle+Math.PI,facing:1};
  // The authored seat top is 0.45 m. Approach and stand from the aisle behind the chair.
  const seat=createSeatAnchor({
    id:'food-court-seat-'+side,name:'Food court chair · '+side,group:'food-court',x:bounds.x,z:bounds.z,floor,
    exit:{x:bounds.x+outward.x*1.05,y:floor,z:bounds.z+outward.z*1.05},pose,
    clearance:{interactionRadius:1,capsuleRadius:.3,colliderWidth:.42,colliderDepth:.45},accessible:true
  },handle,{size:[.42,.80,.45],top:.45,seatCentre:0,front:-.20},1);
  seat.modelVisible=visible;
  return seat;
}

export async function loadFoodCourt({T,R,physics,scene,cameraBounds,installSeat,read,base},signal) {
  if (!globalThis.crypto?.subtle) throw new Error('Food-court integrity verification unavailable');
  const group=new T.Group(); group.name='Singapore food court';
  const loader=new GLTFLoader(), batches=new Map(), geometries=new Set(), materials=new Set();
  const boxes=[], cameraParts=[], handles=[], seatRemovers=[], models=[];
  let mounted=false;
  function collect(geometry, material) {
    if (!batches.has(material)) batches.set(material,[]);
    batches.get(material).push(geometry);
    geometries.add(geometry);
  }
  function addBox(bounds,name) {
    const size=bounds.getSize(new T.Vector3()), centre=bounds.getCenter(new T.Vector3());
    if (!bounds.isEmpty() && [...bounds.min,...bounds.max].every(Number.isFinite))
      boxes.push({name,x:centre.x,y:centre.y,z:centre.z,w:size.x,h:size.y,d:size.z});
  }
  function sightGuard(bounds, ceiling=false) {
    if (bounds.isEmpty() || ![...bounds.min,...bounds.max].every(Number.isFinite)) return;
    if (ceiling) bounds.streetCeiling=true;
    cameraParts.push(bounds);
  }
  function finish(color, extras={}) {
    const material=new T.MeshStandardMaterial({color,roughness:.75,...extras});
    materials.add(material);
    return material;
  }
  function siteBox(material,x,y,z,w,h,d,kind) {
    const geometry=new T.BoxGeometry(w,h,d).translate(x,y,z);
    geometry.deleteAttribute('uv');
    collect(geometry,material);
    geometry.computeBoundingBox();
    if (kind==='post') addBox(geometry.boundingBox,kind);
    if (kind==='post' || kind==='roof') sightGuard(geometry.boundingBox,kind==='roof');
  }
  function dispose() {
    // The shared seat registrar can stand an occupant while their original proxy still exists.
    for (const remove of seatRemovers.splice(0)) remove();
    mounted=false;
    for (const handle of handles.splice(0)) physics.removeCollider(handle,false);
    for (const box of cameraParts) {
      const index=cameraBounds.indexOf(box);
      if (index!==-1) cameraBounds.splice(index,1);
    }
    group.removeFromParent();group.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    geometries.clear();materials.clear();batches.clear();
  }
  try {
    const manifest=await districtManifest(read,base,signal);
    for (const [id,x,y,z,yaw] of sources) {
      const source=await districtModel(loader,read,base,manifest,id,signal);
      const localMaterials=new Map(), display=new T.Box3();
      try {
        source.position.set(x,y,z);source.rotation.y=yaw;source.updateMatrixWorld(true);
        source.traverse(node=>{
          const name=node.userData.name;
          if (name && /^(FLOOR$|REAR_Wall|SIDE_Wall|SERVICE_Counter|STALL_Base|COUNTER_Stainless|PREP_RearWorktop|STALL_Post|Table_Geometry|Chair_)/.test(name))
            addBox(new T.Box3().setFromObject(node),name);
          if (name && /^(ROOF$|HEADER$|STALL_Header$)/.test(name)) sightGuard(new T.Box3().setFromObject(node),true);
          if (name && /^(REAR_Wall|SIDE_Wall|SERVICE_Counter|COUNTER_Stainless|PREP_RearWorktop|STALL_Post)/.test(name))
            sightGuard(new T.Box3().setFromObject(node));
          // Orbit around the display case and its hanging stock as one object.
          if (id==='chicken-rice-stall' && name && /^(DISPLAY_|POULTRY_)/.test(name))
            display.union(new T.Box3().setFromObject(node));
          if (!node.isMesh) return;
          if (!localMaterials.has(node.material)) {
            const material=node.material.clone();
            materials.add(material);
            localMaterials.set(node.material,material);
          }
          collect(node.geometry.clone().applyMatrix4(node.matrixWorld),localMaterials.get(node.material));
        });
        if (!display.isEmpty()) sightGuard(display);
        models.push(id);
      } finally { disposeDistrictSource(source); }
      await new Promise(resolve=>setTimeout(resolve,0));
      signal.throwIfAborted();
    }
    const roofFinish=finish(0xb65732), structure=finish(0x39564a), soffit=finish(0xf1dab2);
    const lamp=finish(0xffe8b5,{emissive:0xffd391,emissiveIntensity:.65});
    siteBox(roofFinish,24,4.29,88.7,13.2,.20,9.8,'roof');
    siteBox(soffit,24,4.16,88.7,13.07,.06,9.67,'roof');
    for (const x of [17.7,30.3]) for (const z of [84.1,93.3])
      siteBox(structure,x,2.06,z,.16,4.16,.16,'post');
    for (const x of [17.7,30.3]) siteBox(structure,x,4.03,88.7,.19,.19,9.50,'roof');
    for (const z of [84.1,93.3]) siteBox(structure,24,4.03,z,12.8,.19,.19,'roof');
    siteBox(lamp,21,2.35,90.73,2.50,.045,.08);
    siteBox(lamp,26.2,2.16,92.51,2.35,.055,.11);
    for (const [material,parts] of batches) {
      const merged=mergeStaticGeometries(T,parts);
      if (!merged) throw new Error('Incompatible food-court geometry');
      for (const part of parts) {part.dispose();geometries.delete(part);}
      geometries.add(merged);
      group.add(new T.Mesh(merged,material));
    }
    batches.clear();
    return {
      safeToMount(x,z) {
        // Do not enclose a visitor behind a counter, even if they miss all four thin solids.
        return !boxes.some(b=>(b.name==='FLOOR' || b.name==='STALL_Base' || b.y+b.h/2>.15 && b.y-b.h/2<1.85) &&
          Math.abs(x-b.x)<b.w/2+.68 && Math.abs(z-b.z)<b.d/2+.68);
      },
      mount() {
        if (mounted) return;
        try {
          for (const b of boxes) {
            const shape=physics.createCollider(R.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.y,b.z));
            handles.push(shape);
            if (b.name.startsWith('Chair_'))
              seatRemovers.push(installSeat(diningSeat(b,shape.handle,()=>mounted)));
          }
          cameraBounds.push(...cameraParts);
          scene.add(group);mounted=true;
        } catch (error) { dispose();throw error; }
      },
      get counts() {return {models:models.length,geometries:geometries.size,materials:materials.size,
        colliders:handles.length,cameraBounds:mounted?cameraParts.length:0,seats:seatRemovers.length};},
      dispose
    };
  } catch (error) { dispose();throw error; }
}
